-- Publicações: execute este arquivo no SQL Editor do Supabase uma vez.
-- Não altera o estoque nem habilita o módulo em congregações existentes.
begin;
create or replace function public.module_of_collection(coll text) returns text language sql immutable as $$
    select case when left(coll,4)='pub_' then 'publicacoes' when coll like 'terr\_%' then 'territorios' when coll like 'desig\_%' then 'designacoes' else 'oradores' end
  $$;

create or replace function public.set_member_access(target_workspace uuid,target_user uuid,new_modules text[],new_readonly text[]) returns boolean language plpgsql security definer set search_path=public as $$
  declare mods text[]; ro text[]; begin
    if not exists(select 1 from public.workspace_members where workspace_id=target_workspace and user_id=auth.uid() and role='owner') then raise exception 'Apenas o proprietário pode alterar acessos'; end if;
    if exists(select 1 from public.workspace_members where workspace_id=target_workspace and user_id=target_user and role='owner') then raise exception 'O proprietário sempre tem acesso a tudo'; end if;
    select coalesce(array_agg(distinct m),'{}') into mods from unnest(new_modules) m where m in ('oradores','territorios','designacoes','publicacoes');
    if cardinality(mods)=0 then raise exception 'Escolha pelo menos um módulo (ou remova o integrante)'; end if;
    select coalesce(array_agg(distinct r),'{}') into ro from unnest(coalesce(new_readonly,'{}')) r where r=any(mods);
    update public.workspace_members set modules=mods,readonly=ro where workspace_id=target_workspace and user_id=target_user;
    return found;
  end $$;

create or replace function public.create_workspace_invite_access(target_workspace uuid,invite_modules text[],invite_readonly text[]) returns uuid language plpgsql security definer set search_path=public as $$
  declare invite_token uuid; mods text[]; ro text[]; begin
    if not exists(select 1 from public.workspace_members where workspace_id=target_workspace and user_id=auth.uid() and role='owner') then raise exception 'Apenas o proprietário pode convidar pessoas'; end if;
    select coalesce(array_agg(distinct m),'{}') into mods from unnest(invite_modules) m where m in ('oradores','territorios','designacoes','publicacoes');
    if cardinality(mods)=0 then raise exception 'Escolha pelo menos um módulo'; end if;
    select coalesce(array_agg(distinct r),'{}') into ro from unnest(coalesce(invite_readonly,'{}')) r where r=any(mods);
    delete from public.workspace_invites where expires_at<now() or (created_by=auth.uid() and accepted_at is not null);
    insert into public.workspace_invites(workspace_id,created_by,modules,readonly) values(target_workspace,auth.uid(),mods,ro) returning token into invite_token; return invite_token;
  end $$;

create or replace function public.list_workspace_access(target_workspace uuid)
  returns table(user_id uuid,email text,role text,modules text[],readonly text[]) language sql security definer stable set search_path=public,auth as $$
    select m.user_id,u.email::text,m.role,
      case when m.role='owner' then array['oradores','territorios','designacoes','publicacoes'] else m.modules end,
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
    or not new_modules <@ array['oradores','territorios','designacoes','publicacoes']::text[] then
    raise exception 'Escolha pelo menos um módulo válido';
  end if;
  update public.workspaces set enabled_modules=array(select distinct unnest(new_modules)),modules_configured_at=now() where id=target_workspace;
  return found;
end $$;

create or replace function public.can_write_collection(target uuid,coll text) returns boolean language sql security definer stable set search_path=public as $$
    select case when left(coll,4)='pub_' then false when coll like 'cong\_%' then (public.can_write_module(target,'oradores') or public.can_write_module(target,'territorios') or public.can_write_module(target,'designacoes') or public.can_write_module(target,'publicacoes'))
      else public.can_write_module(target,public.module_of_collection(coll)) end
  $$;

create or replace function public.set_workspace_display_name(target_workspace uuid,new_name text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not (public.can_write_module(target_workspace,'oradores') or public.can_write_module(target_workspace,'territorios') or public.can_write_module(target_workspace,'designacoes') or public.can_write_module(target_workspace,'publicacoes')) then
    raise exception 'Sem permissão para alterar esta congregação';
  end if;
  if length(trim(new_name))<2 then raise exception 'Informe o nome da congregação'; end if;
  update public.workspaces set name=trim(new_name) where id=target_workspace;return found;
end $$;

alter table public.workspaces alter column enabled_modules set default array['oradores','territorios','designacoes','publicacoes']::text[];
create or replace function public.save_publication_order(target_workspace uuid,order_id text,expected_revision integer,payload jsonb)
returns integer language plpgsql security definer set search_path=public as $$
declare current_data jsonb; next_revision integer; item jsonb; qty integer; sent integer; received integer; delivered integer;
begin
  perform 1 from public.workspaces where id=target_workspace for update;
  if not public.can_write_module(target_workspace,'publicacoes') then raise exception 'Sem permissão para editar Publicações'; end if;
  if order_id is null or length(order_id)>100 or length(order_id)=0 or expected_revision is null or expected_revision<0 then raise exception 'Pedido inválido'; end if;
  select data into current_data from public.app_records where workspace_id=target_workspace and collection='pub_pedidos' and id=order_id for update;
  if (current_data is null and expected_revision<>0) or (current_data is not null and coalesce((current_data->>'revision')::integer,0)<>expected_revision) then raise exception 'Pedido alterado por outra pessoa'; end if;
  if payload->>'solicitanteTipo' is null or payload->>'solicitanteTipo' not in ('pessoa','congregacao') or coalesce(length(trim(payload->>'nome')),0)=0 or coalesce(payload->>'data','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Informe solicitante e data'; end if;
  if jsonb_typeof(payload->'itens') is distinct from 'array' then raise exception 'Informe as publicações'; end if;
  if jsonb_array_length(payload->'itens') not between 1 and 200 then raise exception 'Informe entre 1 e 200 publicações'; end if;
  for item in select * from jsonb_array_elements(payload->'itens') loop
    if coalesce(length(trim(item->>'codigo')),0)=0 or coalesce(length(trim(item->>'titulo')),0)=0 or coalesce(length(trim(item->>'idioma')),0)=0 then raise exception 'Publicação incompleta'; end if;
    if jsonb_typeof(item->'quantidade') is distinct from 'number' or jsonb_typeof(item->'enviado') is distinct from 'number' or jsonb_typeof(item->'recebido') is distinct from 'number' or jsonb_typeof(item->'entregue') is distinct from 'number' or coalesce(item->>'quantidade','') !~ '^\d{1,7}$' or coalesce(item->>'enviado','') !~ '^\d{1,7}$' or coalesce(item->>'recebido','') !~ '^\d{1,7}$' or coalesce(item->>'entregue','') !~ '^\d{1,7}$' then raise exception 'Quantidades inválidas'; end if;
    qty:=(item->>'quantidade')::integer; sent:=(item->>'enviado')::integer; received:=(item->>'recebido')::integer; delivered:=(item->>'entregue')::integer;
    if qty not between 1 and 1000000 or sent>qty or received>sent or delivered>received or (payload->>'solicitanteTipo'='congregacao' and delivered<>0) then raise exception 'Confira as quantidades do pedido'; end if;
  end loop;
  next_revision:=expected_revision+1;
  insert into public.app_records(id,workspace_id,owner_id,collection,data)
  values(order_id,target_workspace,auth.uid(),'pub_pedidos',payload||jsonb_build_object('revision',next_revision,'atualizadoEm',now(),'atualizadoPor',auth.uid()))
  on conflict(workspace_id,collection,id) do update set data=excluded.data;
  return next_revision;
end $$;

create or replace function public.save_publication_inventory(target_workspace uuid,reference_month text,expected_revision integer,payload jsonb)
returns integer language plpgsql security definer set search_path=public as $$
declare current_data jsonb; next_revision integer; item jsonb;
begin
  perform 1 from public.workspaces where id=target_workspace for update;
  if not public.can_write_module(target_workspace,'publicacoes') then raise exception 'Sem permissão para editar Publicações'; end if;
  if reference_month is null or reference_month !~ '^20\d{2}-(0[1-9]|1[0-2])$' or expected_revision is null or expected_revision<0 then raise exception 'Mês inválido'; end if;
  select data into current_data from public.app_records where workspace_id=target_workspace and collection='pub_estoque' and id=reference_month for update;
  if (current_data is null and expected_revision<>0) or (current_data is not null and coalesce((current_data->>'revision')::integer,0)<>expected_revision) then raise exception 'Relatório alterado por outra pessoa'; end if;
  if jsonb_typeof(payload->'itens') is distinct from 'array' then raise exception 'Relatório inválido'; end if;
  if jsonb_array_length(payload->'itens') not between 1 and 2000 then raise exception 'Relatório inválido'; end if;
  for item in select * from jsonb_array_elements(payload->'itens') loop
    if coalesce(length(trim(item->>'codigo')),0)=0 or coalesce(length(trim(item->>'titulo')),0)=0 or coalesce(length(trim(item->>'idioma')),0)=0 or coalesce(item->>'quantidade','') !~ '^\d{1,7}$' then raise exception 'Item do relatório inválido'; end if;
    if (item->>'quantidade')::integer>1000000 then raise exception 'Quantidade inválida'; end if;
  end loop;
  if not starts_with(coalesce(payload->>'arquivo',''),target_workspace::text||'/'||reference_month||'/') then raise exception 'Arquivo inválido'; end if;
  next_revision:=expected_revision+1;
  insert into public.app_records(id,workspace_id,owner_id,collection,data)
  values(reference_month,target_workspace,auth.uid(),'pub_estoque',payload||jsonb_build_object('mes',reference_month,'revision',next_revision,'importadoEm',now()))
  on conflict(workspace_id,collection,id) do update set data=excluded.data;
  return next_revision;
end $$;
revoke all on function public.save_publication_order(uuid,text,integer,jsonb),public.save_publication_inventory(uuid,text,integer,jsonb) from public,anon;
grant execute on function public.save_publication_order(uuid,text,integer,jsonb),public.save_publication_inventory(uuid,text,integer,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('publicacoes','publicacoes',false,10485760,array['application/pdf']) on conflict(id) do nothing;
drop policy if exists "Publicações lê PDFs" on storage.objects;
drop policy if exists "Publicações envia PDFs" on storage.objects;
drop policy if exists "Publicações remove PDFs" on storage.objects;
create policy "Publicações lê PDFs" on storage.objects for select to authenticated using(bucket_id='publicacoes' and public.has_workspace_module(public.storage_workspace(name),'publicacoes'));
create policy "Publicações envia PDFs" on storage.objects for insert to authenticated with check(bucket_id='publicacoes' and public.can_write_module(public.storage_workspace(name),'publicacoes'));
create policy "Publicações remove PDFs" on storage.objects for delete to authenticated using(bucket_id='publicacoes' and public.can_write_module(public.storage_workspace(name),'publicacoes'));
commit;
