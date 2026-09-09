-- Execute uma vez no SQL Editor de um projeto Supabase novo.
create extension if not exists pgcrypto;

create table if not exists public.app_records (
  pk uuid primary key default gen_random_uuid(),
  id text not null default gen_random_uuid()::text,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  collection text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) default auth.uid(),
  unique (owner_id, collection, id)
);

create index if not exists app_records_owner_collection_idx on public.app_records (owner_id, collection);
alter table public.app_records enable row level security;
revoke all on table public.app_records from anon;
grant select, insert, update, delete on table public.app_records to authenticated;

drop policy if exists "Usuário lê os próprios dados" on public.app_records;
drop policy if exists "Usuário insere os próprios dados" on public.app_records;
drop policy if exists "Usuário atualiza os próprios dados" on public.app_records;
drop policy if exists "Usuário exclui os próprios dados" on public.app_records;
create policy "Usuário lê os próprios dados" on public.app_records for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Usuário insere os próprios dados" on public.app_records for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Usuário atualiza os próprios dados" on public.app_records for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Usuário exclui os próprios dados" on public.app_records for delete to authenticated using ((select auth.uid()) = owner_id);

create or replace function public.touch_app_record() returns trigger language plpgsql security invoker as $$
begin new.updated_at=now();new.updated_by=auth.uid();return new;end $$;
drop trigger if exists app_records_touch on public.app_records;
create trigger app_records_touch before update on public.app_records for each row execute function public.touch_app_record();

create table if not exists public.speaker_shares (
  token uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);
alter table public.speaker_shares enable row level security;
revoke all on table public.speaker_shares from anon;
grant select, insert, delete on table public.speaker_shares to authenticated;
drop policy if exists "Dono gerencia links" on public.speaker_shares;
create policy "Dono gerencia links" on public.speaker_shares for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

create or replace function public.get_shared_speakers(share_token uuid)
returns jsonb language sql security definer set search_path = public stable as $$
  select payload from public.speaker_shares
  where token = share_token and expires_at > now() and auth.uid() is not null
$$;
revoke all on function public.get_shared_speakers(uuid) from public, anon;
grant execute on function public.get_shared_speakers(uuid) to authenticated;

-- EQUIPES: execute também este bloco em projetos que já estavam funcionando.
create table if not exists public.workspaces (id uuid primary key default gen_random_uuid(),name text not null default 'Minha Congregação',created_by uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now());
create table if not exists public.workspace_members (workspace_id uuid not null references public.workspaces(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,role text not null default 'editor' check (role in ('owner','editor')),joined_at timestamptz not null default now(),primary key (workspace_id,user_id));
create table if not exists public.workspace_invites (token uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade,created_by uuid not null references auth.users(id) on delete cascade,expires_at timestamptz not null default (now() + interval '24 hours'),accepted_by uuid references auth.users(id),accepted_at timestamptz);
alter table public.app_records add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

do $$ declare uid uuid; wid uuid; begin
  for uid in select distinct owner_id from public.app_records loop
    select workspace_id into wid from public.workspace_members where user_id=uid order by joined_at limit 1;
    if wid is null then
      insert into public.workspaces(name,created_by) values ('Minha Congregação',uid) returning id into wid;
      insert into public.workspace_members(workspace_id,user_id,role) values(wid,uid,'owner');
    end if;
    update public.app_records set workspace_id=wid where owner_id=uid and workspace_id is null;
  end loop;
end $$;
create unique index if not exists app_records_workspace_collection_id_uidx on public.app_records(workspace_id,collection,id);
create index if not exists app_records_workspace_collection_idx on public.app_records(workspace_id,collection);
alter table public.app_records drop constraint if exists app_records_owner_id_collection_id_key;

create or replace function public.is_workspace_member(target uuid) returns boolean language sql security definer stable set search_path=public as $$ select exists(select 1 from public.workspace_members where workspace_id=target and user_id=auth.uid()) $$;
create or replace function public.ensure_personal_workspace() returns uuid language plpgsql security definer set search_path=public as $$
declare wid uuid; begin
  if auth.uid() is null then raise exception 'Login necessário'; end if;
  select workspace_id into wid from public.workspace_members where user_id=auth.uid() order by joined_at limit 1;
  if wid is null then insert into public.workspaces(created_by) values(auth.uid()) returning id into wid; insert into public.workspace_members(workspace_id,user_id,role) values(wid,auth.uid(),'owner'); end if;
  return wid;
end $$;
create or replace function public.create_workspace_invite(target_workspace uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare invite_token uuid; begin
  if not exists(select 1 from public.workspace_members where workspace_id=target_workspace and user_id=auth.uid() and role='owner') then raise exception 'Apenas o proprietário pode convidar pessoas'; end if;
  delete from public.workspace_invites where expires_at<now() or (created_by=auth.uid() and accepted_at is not null);
  insert into public.workspace_invites(workspace_id,created_by) values(target_workspace,auth.uid()) returning token into invite_token; return invite_token;
end $$;
create or replace function public.accept_workspace_invite(invite_token uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare wid uuid; begin
  if auth.uid() is null then raise exception 'Entre com Google para aceitar'; end if;
  select workspace_id into wid from public.workspace_invites where token=invite_token and expires_at>now() and accepted_at is null for update;
  if wid is null then raise exception 'Convite inválido, expirado ou já utilizado'; end if;
  insert into public.workspace_members(workspace_id,user_id,role) values(wid,auth.uid(),'editor') on conflict do nothing;
  update public.workspace_invites set accepted_by=auth.uid(),accepted_at=now() where token=invite_token; return wid;
end $$;
create or replace function public.list_workspace_members(target_workspace uuid)
returns table(user_id uuid,email text,role text) language sql security definer stable set search_path=public,auth as $$
  select m.user_id,u.email,m.role from public.workspace_members m join auth.users u on u.id=m.user_id
  where m.workspace_id=target_workspace and public.is_workspace_member(target_workspace) order by m.joined_at
$$;
create or replace function public.remove_workspace_member(target_workspace uuid,target_user uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.workspace_members where workspace_id=target_workspace and user_id=auth.uid() and role='owner') then raise exception 'Apenas o proprietário pode remover acessos'; end if;
  if exists(select 1 from public.workspace_members where workspace_id=target_workspace and user_id=target_user and role='owner') then raise exception 'O proprietário não pode ser removido'; end if;
  delete from public.workspace_members where workspace_id=target_workspace and user_id=target_user; return found;
end $$;

alter table public.workspaces enable row level security; alter table public.workspace_members enable row level security; alter table public.workspace_invites enable row level security;
grant select on public.workspaces,public.workspace_members to authenticated;
revoke all on function public.ensure_personal_workspace() from public,anon;
revoke all on function public.create_workspace_invite(uuid) from public,anon;
revoke all on function public.accept_workspace_invite(uuid) from public,anon;
revoke all on function public.is_workspace_member(uuid) from public,anon;
revoke all on function public.list_workspace_members(uuid) from public,anon;
revoke all on function public.remove_workspace_member(uuid,uuid) from public,anon;
grant execute on function public.ensure_personal_workspace(),public.create_workspace_invite(uuid),public.accept_workspace_invite(uuid),public.is_workspace_member(uuid),public.list_workspace_members(uuid),public.remove_workspace_member(uuid,uuid) to authenticated;
drop policy if exists "Membros veem a equipe" on public.workspaces;
create policy "Membros veem a equipe" on public.workspaces for select to authenticated using(public.is_workspace_member(id));
drop policy if exists "Membros veem participantes" on public.workspace_members;
create policy "Membros veem participantes" on public.workspace_members for select to authenticated using(public.is_workspace_member(workspace_id));
do $$ declare pol record; begin for pol in select policyname from pg_policies where schemaname='public' and tablename='app_records' loop execute format('drop policy if exists %I on public.app_records',pol.policyname); end loop; end $$;
create policy "Equipe lê os dados" on public.app_records for select to authenticated using(public.is_workspace_member(workspace_id));
create policy "Equipe insere dados" on public.app_records for insert to authenticated with check(public.is_workspace_member(workspace_id) and owner_id=auth.uid());
create policy "Equipe atualiza dados" on public.app_records for update to authenticated using(public.is_workspace_member(workspace_id)) with check(public.is_workspace_member(workspace_id));
create policy "Equipe exclui dados" on public.app_records for delete to authenticated using(public.is_workspace_member(workspace_id));

-- INTEGRIDADE, AUDITORIA E LIXEIRA (seguro para executar novamente).
delete from public.app_records a using public.app_records b
where a.pk<b.pk and a.workspace_id=b.workspace_id and a.collection=b.collection
  and ((a.collection in ('programa','sentinela') and a.data->>'data'=b.data->>'data')
    or (a.collection='oradores' and lower(trim(a.data->>'nome'))=lower(trim(b.data->>'nome')) and lower(trim(a.data->>'cong'))=lower(trim(b.data->>'cong'))));
create unique index if not exists app_records_programa_data_uidx on public.app_records(workspace_id,(data->>'data')) where collection='programa' and data ? 'data';
create unique index if not exists app_records_sentinela_data_uidx on public.app_records(workspace_id,(data->>'data')) where collection='sentinela' and data ? 'data';
create unique index if not exists app_records_orador_identidade_uidx on public.app_records(workspace_id,lower(trim(data->>'nome')),lower(trim(data->>'cong'))) where collection='oradores' and data ? 'nome';
alter table public.app_records drop constraint if exists app_records_required_data_check;
alter table public.app_records add constraint app_records_required_data_check check(
  (collection not in ('programa','discursos','sentinela') or (data ? 'data' and (data->>'data') ~ '^\d{4}-\d{2}-\d{2}$')) and
  (collection<>'oradores' or length(trim(data->>'nome'))>0)
) not valid;

create table if not exists public.app_record_audit(id bigint generated always as identity primary key,workspace_id uuid,record_id text,collection text,action text not null,old_data jsonb,new_data jsonb,changed_by uuid,changed_at timestamptz not null default now());
create table if not exists public.app_record_trash(id bigint generated always as identity primary key,workspace_id uuid not null,record_id text not null,collection text not null,data jsonb not null,deleted_by uuid,deleted_at timestamptz not null default now(),recover_until timestamptz not null default(now()+interval '30 days'));
alter table public.app_record_audit enable row level security;alter table public.app_record_trash enable row level security;
grant select on public.app_record_audit,public.app_record_trash to authenticated;
drop policy if exists "Equipe ve auditoria" on public.app_record_audit;create policy "Equipe ve auditoria" on public.app_record_audit for select to authenticated using(public.is_workspace_member(workspace_id));
drop policy if exists "Equipe ve lixeira" on public.app_record_trash;create policy "Equipe ve lixeira" on public.app_record_trash for select to authenticated using(public.is_workspace_member(workspace_id));
create or replace function public.audit_app_record() returns trigger language plpgsql security definer set search_path=public as $$ begin
  insert into public.app_record_audit(workspace_id,record_id,collection,action,old_data,new_data,changed_by) values(coalesce(new.workspace_id,old.workspace_id),coalesce(new.id,old.id),coalesce(new.collection,old.collection),tg_op,case when tg_op<>'INSERT' then old.data end,case when tg_op<>'DELETE' then new.data end,auth.uid());
  if tg_op='DELETE' then delete from public.app_record_trash where recover_until<now();insert into public.app_record_trash(workspace_id,record_id,collection,data,deleted_by) values(old.workspace_id,old.id,old.collection,old.data,auth.uid());return old;end if;return new;
end $$;
drop trigger if exists app_records_audit on public.app_records;create trigger app_records_audit after insert or update or delete on public.app_records for each row execute function public.audit_app_record();
create or replace function public.restore_app_record(trash_id bigint) returns boolean language plpgsql security definer set search_path=public as $$ declare item public.app_record_trash;begin
  select * into item from public.app_record_trash where id=trash_id and recover_until>now() and public.is_workspace_member(workspace_id) for update;if item.id is null then return false;end if;
  insert into public.app_records(id,workspace_id,owner_id,collection,data) values(item.record_id,item.workspace_id,auth.uid(),item.collection,item.data) on conflict(workspace_id,collection,id) do update set data=excluded.data;delete from public.app_record_trash where id=trash_id;return true;
end $$;
revoke all on function public.restore_app_record(bigint) from public,anon;grant execute on function public.restore_app_record(bigint) to authenticated;
