-- Execute depois de publicacoes/migration.sql (ou use o supabase.sql completo atualizado).
-- Quadro de anúncios passa a ter acesso próprio; não libera a edição dos módulos de origem.
begin;

create or replace function public.set_member_access(target_workspace uuid,target_user uuid,new_modules text[],new_readonly text[]) returns boolean language plpgsql security definer set search_path=public as $$
  declare mods text[]; ro text[]; begin
    if not exists(select 1 from public.workspace_members where workspace_id=target_workspace and user_id=auth.uid() and role='owner') then raise exception 'Apenas o proprietário pode alterar acessos'; end if;
    if exists(select 1 from public.workspace_members where workspace_id=target_workspace and user_id=target_user and role='owner') then raise exception 'O proprietário sempre tem acesso a tudo'; end if;
    select coalesce(array_agg(distinct m),'{}') into mods from unnest(new_modules) m where m in ('oradores','territorios','designacoes','publicacoes','quadro');
    if cardinality(mods)=0 then raise exception 'Escolha pelo menos um módulo (ou remova o integrante)'; end if;
    select coalesce(array_agg(distinct r),'{}') into ro from unnest(coalesce(new_readonly,'{}')) r where r=any(mods);
    update public.workspace_members set modules=mods,readonly=ro where workspace_id=target_workspace and user_id=target_user;
    return found;
  end $$;

create or replace function public.create_workspace_invite_access(target_workspace uuid,invite_modules text[],invite_readonly text[]) returns uuid language plpgsql security definer set search_path=public as $$
  declare invite_token uuid; mods text[]; ro text[]; begin
    if not exists(select 1 from public.workspace_members where workspace_id=target_workspace and user_id=auth.uid() and role='owner') then raise exception 'Apenas o proprietário pode convidar pessoas'; end if;
    select coalesce(array_agg(distinct m),'{}') into mods from unnest(invite_modules) m where m in ('oradores','territorios','designacoes','publicacoes','quadro');
    if cardinality(mods)=0 then raise exception 'Escolha pelo menos um módulo'; end if;
    select coalesce(array_agg(distinct r),'{}') into ro from unnest(coalesce(invite_readonly,'{}')) r where r=any(mods);
    delete from public.workspace_invites where expires_at<now() or (created_by=auth.uid() and accepted_at is not null);
    insert into public.workspace_invites(workspace_id,created_by,modules,readonly) values(target_workspace,auth.uid(),mods,ro) returning token into invite_token; return invite_token;
  end $$;

create or replace function public.list_workspace_access(target_workspace uuid)
  returns table(user_id uuid,email text,role text,modules text[],readonly text[]) language sql security definer stable set search_path=public,auth as $$
    select m.user_id,u.email::text,m.role,
      case when m.role='owner' then array['oradores','territorios','designacoes','publicacoes','quadro'] else m.modules end,
      case when m.role='owner' then '{}'::text[] else m.readonly end
    from public.workspace_members m join auth.users u on u.id=m.user_id
    where m.workspace_id=target_workspace and public.is_workspace_member(target_workspace) order by m.role desc,u.email
  $$;

create or replace function public.set_workspace_modules(target_workspace uuid,new_modules text[])
returns boolean language plpgsql security definer set search_path=public as $$
begin
  perform 1 from public.workspaces where id=target_workspace for update;
  if not exists(select 1 from public.workspace_members where workspace_id=target_workspace and user_id=auth.uid() and role='owner') then
    raise exception 'Somente o proprietário pode escolher os módulos da congregação';
  end if;
  if new_modules is null or cardinality(new_modules)=0 or array_position(new_modules,null) is not null
    or not new_modules <@ array['oradores','territorios','designacoes','publicacoes','quadro']::text[] then
    raise exception 'Escolha pelo menos um módulo válido';
  end if;
  update public.workspaces set enabled_modules=array(select distinct unnest(new_modules)),modules_configured_at=now() where id=target_workspace;
  return found;
end $$;


-- A configuração existente é migrada apenas uma vez, preservando futuras escolhas de "Sem acesso".
alter table public.workspaces add column if not exists noticeboard_access_migrated_at timestamptz;
update public.workspace_members m set
  modules=array(select distinct unnest(m.modules||array['quadro']::text[])),
  readonly=case when exists(select 1 from unnest(m.modules) k where k in ('oradores','designacoes') and k=any(w.enabled_modules) and not k=any(m.readonly))
    then m.readonly else array(select distinct unnest(m.readonly||array['quadro']::text[])) end
from public.workspaces w where w.id=m.workspace_id and w.noticeboard_access_migrated_at is null
  and exists(select 1 from unnest(m.modules) k where k in ('oradores','designacoes') and k=any(w.enabled_modules))
  and not 'quadro'=any(m.modules);
update public.workspace_invites i set
  modules=array(select distinct unnest(i.modules||array['quadro']::text[])),
  readonly=case when exists(select 1 from unnest(i.modules) k where k in ('oradores','designacoes') and k=any(w.enabled_modules) and not k=any(i.readonly))
    then i.readonly else array(select distinct unnest(i.readonly||array['quadro']::text[])) end
from public.workspaces w where w.id=i.workspace_id and w.noticeboard_access_migrated_at is null and i.accepted_at is null
  and exists(select 1 from unnest(i.modules) k where k in ('oradores','designacoes') and k=any(w.enabled_modules))
  and not 'quadro'=any(i.modules);
update public.workspaces set
  enabled_modules=case when 'oradores'=any(enabled_modules) or 'designacoes'=any(enabled_modules)
    then array(select distinct unnest(enabled_modules||array['quadro']::text[])) else enabled_modules end,
  noticeboard_access_migrated_at=now()
where noticeboard_access_migrated_at is null;
alter table public.workspaces alter column noticeboard_access_migrated_at set default now();
alter table public.workspaces alter column enabled_modules set default array['oradores','territorios','designacoes','publicacoes','quadro']::text[];

-- Retorna exclusivamente os dados usados pelos PDFs, sem telefones, observações ou acesso de edição.
create or replace function public.get_workspace_noticeboard(target_workspace uuid)
returns jsonb language plpgsql security definer stable set search_path=public as $$
declare active_modules text[]; records jsonb;
begin
  if not public.has_workspace_module(target_workspace,'quadro') then raise exception 'Sem acesso ao Quadro de anúncios'; end if;
  select enabled_modules into active_modules from public.workspaces where id=target_workspace;
  select coalesce(jsonb_object_agg(collection,items),'{}'::jsonb) into records from (
    select collection,jsonb_agg(projected||jsonb_build_object('id',id)) as items from (
      select a.collection,a.id,
        case
          when a.collection in ('cong_pessoas','desig_pessoas','oradores') then jsonb_build_object('nome',a.data->'nome','ativo',a.data->'ativo','cong',a.data->'cong')
          when a.collection='config' and a.id='temas' then jsonb_build_object('overrides',a.data->'overrides')
          when a.collection='config' then jsonb_build_object('dia',a.data->'dia','dia2027',a.data->'dia2027','end',a.data->'end','hor',a.data->'hor')
          when a.collection='desig_config' then jsonb_build_object('diaMeio',a.data->'diaMeio','diaMeio2027',a.data->'diaMeio2027','diaFim',a.data->'diaFim','diaFim2027',a.data->'diaFim2027','quantidades',a.data->'quantidades','zoomSemanal',a.data->'zoomSemanal','campo',a.data->'campo')
          when a.collection='desig_reunioes' then jsonb_build_object('data',a.data->'data','tipo',a.data->'tipo','pessoas',a.data->'pessoas','semReuniao',a.data->'semReuniao','motivo',a.data->'motivo')
          when a.collection='desig_campo' then jsonb_build_object('data',a.data->'data','saidaId',a.data->'saidaId','hora',a.data->'hora','localId',a.data->'localId','dirigente',a.data->'dirigente','semSaida',a.data->'semSaida','recorrente',a.data->'recorrente','grupoId',a.data->'grupoId','grupoNome',a.data->'grupoNome','grupo',a.data->'grupo')
          else jsonb_build_object('data',a.data->'data','nome',a.data->'nome','congregacao',a.data->'congregacao','tema',a.data->'tema','temaNum',a.data->'temaNum','cantico',a.data->'cantico','canticoNum',a.data->'canticoNum','especial',a.data->'especial','especialTitulo',a.data->'especialTitulo','especialCor',a.data->'especialCor','semDiscurso',a.data->'semDiscurso','motivo',a.data->'motivo','semDiscursoCor',a.data->'semDiscursoCor','temImagens',a.data->'temImagens')
        end as projected
      from public.app_records a where a.workspace_id=target_workspace and (
        ('oradores'=any(active_modules) and (a.collection in ('oradores','programa','discursos') or (a.collection='config' and a.id in ('app','temas'))))
        or ('designacoes'=any(active_modules) and (a.collection in ('desig_reunioes','desig_pessoas','cong_pessoas','desig_campo') or (a.collection='desig_config' and a.id='app')))
      )
    ) visible_rows group by collection
  ) grouped;
  return jsonb_build_object('acesso',jsonb_build_object('oradores','oradores'=any(active_modules),'designacoes','designacoes'=any(active_modules)),'registros',records);
end $$;
revoke all on function public.get_workspace_noticeboard(uuid) from public,anon;
grant execute on function public.get_workspace_noticeboard(uuid) to authenticated;
commit;
