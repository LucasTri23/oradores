-- Escolha única por congregação; NULL em modules_configured_at solicita a escolha ao proprietário.
begin;
alter table public.workspaces add column if not exists enabled_modules text[] not null default array['oradores','territorios','designacoes']::text[];
alter table public.workspaces add column if not exists modules_configured_at timestamptz;

create or replace function public.set_workspace_modules(target_workspace uuid,new_modules text[])
returns boolean language plpgsql security definer set search_path=public as $$
begin
  perform 1 from public.workspaces where id=target_workspace for update;
  if not exists(select 1 from public.workspace_members where workspace_id=target_workspace and user_id=auth.uid() and role='owner') then
    raise exception 'Somente o proprietário pode escolher os módulos da congregação';
  end if;
  if new_modules is null or cardinality(new_modules)=0 or array_position(new_modules,null) is not null
    or not new_modules <@ array['oradores','territorios','designacoes']::text[] then
    raise exception 'Escolha pelo menos um módulo válido';
  end if;
  update public.workspaces set enabled_modules=array(select distinct unnest(new_modules)),modules_configured_at=now() where id=target_workspace;
  return found;
end $$;
revoke all on function public.set_workspace_modules(uuid,text[]) from public,anon;
grant execute on function public.set_workspace_modules(uuid,text[]) to authenticated;
-- Alterações de módulos passam exclusivamente pela função acima.
revoke update on public.workspaces from authenticated;

create or replace function public.has_workspace_module(target uuid,module_name text)
returns boolean language sql security definer stable set search_path=public as $$
  select exists(select 1 from public.workspace_members m join public.workspaces w on w.id=m.workspace_id
    where m.workspace_id=target and m.user_id=auth.uid() and module_name=any(w.enabled_modules)
    and (m.role='owner' or module_name=any(m.modules)))
$$;
create or replace function public.can_write_module(target uuid,module_name text)
returns boolean language sql security definer stable set search_path=public as $$
  select exists(select 1 from public.workspace_members m join public.workspaces w on w.id=m.workspace_id
    where m.workspace_id=target and m.user_id=auth.uid() and module_name=any(w.enabled_modules)
    and (m.role='owner' or (module_name=any(m.modules) and not module_name=any(m.readonly))))
$$;
revoke all on function public.has_workspace_module(uuid,text),public.can_write_module(uuid,text) from public,anon;
grant execute on function public.has_workspace_module(uuid,text),public.can_write_module(uuid,text) to authenticated;

create or replace function public.set_workspace_display_name(target_workspace uuid,new_name text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not (public.can_write_module(target_workspace,'oradores') or public.can_write_module(target_workspace,'territorios') or public.can_write_module(target_workspace,'designacoes')) then
    raise exception 'Sem permissão para alterar esta congregação';
  end if;
  if length(trim(new_name))<2 then raise exception 'Informe o nome da congregação'; end if;
  update public.workspaces set name=trim(new_name) where id=target_workspace;return found;
end $$;
commit;
