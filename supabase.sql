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
create policy "Dono gerencia links" on public.speaker_shares for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

create or replace function public.get_shared_speakers(share_token uuid)
returns jsonb language sql security definer set search_path = public stable as $$
  select payload from public.speaker_shares
  where token = share_token and expires_at > now() and auth.uid() is not null
$$;
revoke all on function public.get_shared_speakers(uuid) from public, anon;
grant execute on function public.get_shared_speakers(uuid) to authenticated;
