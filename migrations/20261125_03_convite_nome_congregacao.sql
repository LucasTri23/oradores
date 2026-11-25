-- Permite mostrar o nome da congregação antes do login, apenas para quem tem um convite válido.
-- Não retorna integrantes, permissões, e-mails ou outros dados da congregação.
begin;
create or replace function public.get_workspace_invite_name(invite_token uuid)
returns text language sql security definer stable set search_path=public as $$
  select w.name
  from public.workspace_invites i
  join public.workspaces w on w.id=i.workspace_id
  where i.token=invite_token and i.expires_at>now() and i.accepted_at is null
$$;
revoke all on function public.get_workspace_invite_name(uuid) from public;
grant execute on function public.get_workspace_invite_name(uuid) to anon,authenticated;
commit;
