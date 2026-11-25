-- Arquivos do discurso da semana (.jwpub / .jwlplaylist) no Oradores. Seguro para executar novamente.
-- Caminho: <id da congregação>/discursos/<AAAA-MM-DD>/<arquivo>
--  • Quem pode ver o Oradores lê e baixa.
--  • Quem pode editar o Oradores envia (só .jwpub/.jwlplaylist, só durante a semana do discurso) e remove.
--  • Quando a semana passa, qualquer integrante com acesso ao Oradores pode apagar (o app faz isso sozinho ao abrir).
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('oradores','oradores',false,52428800,array['application/octet-stream'])
  on conflict(id) do update set file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.oradores_arquivo_data(object_name text) returns date language plpgsql immutable as $$
begin
  if split_part(object_name,'/',2)<>'discursos' then return null; end if;
  return split_part(object_name,'/',3)::date;
exception when others then return null; end $$;
create or replace function public.oradores_hoje() returns date language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;
grant execute on function public.oradores_arquivo_data(text),public.oradores_hoje() to authenticated;

drop policy if exists "Oradores lê arquivos" on storage.objects;
drop policy if exists "Oradores envia arquivos" on storage.objects;
drop policy if exists "Oradores exclui arquivos" on storage.objects;
create policy "Oradores lê arquivos" on storage.objects for select to authenticated
  using(bucket_id='oradores' and public.has_workspace_module(public.storage_workspace(name),'oradores'));
create policy "Oradores envia arquivos" on storage.objects for insert to authenticated
  with check(bucket_id='oradores'
    and public.can_write_module(public.storage_workspace(name),'oradores')
    and name ~* '^[0-9a-f-]{36}/discursos/[0-9]{4}-[0-9]{2}-[0-9]{2}/[^/]+\.(jwpub|jwlplaylist)$'
    and public.oradores_hoje() between date_trunc('week',public.oradores_arquivo_data(name))::date and public.oradores_arquivo_data(name));
create policy "Oradores exclui arquivos" on storage.objects for delete to authenticated
  using(bucket_id='oradores' and (
    public.can_write_module(public.storage_workspace(name),'oradores')
    or (public.has_workspace_module(public.storage_workspace(name),'oradores')
        and public.oradores_arquivo_data(name) < date_trunc('week',public.oradores_hoje())::date)));
commit;
