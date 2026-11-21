-- 0008_request_photos: fotos de la solicitud y bucket privado request-photos (CU-03). Requiere 0007.
-- Ruta en Storage: {request_id}/{uuid}. Solo participantes ven las fotos; solo el cliente las sube o borra, en `draft`.

create table public.request_photos (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests (id) on delete cascade,
  path text not null unique,
  created_at timestamptz not null default now(),
  -- La ruta debe ser {request_id}/{uuid}: nadie registra fotos de otra solicitud.
  constraint request_photos_path_format check (
    path ~ ('^' || request_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  )
);

create index request_photos_request_idx on public.request_photos (request_id, created_at);

-- Máximo 5 fotos por solicitud.
create function private.check_request_photo_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.request_photos f where f.request_id = new.request_id) >= 5 then
    raise exception 'limit_reached';
  end if;
  return new;
end;
$$;

create trigger request_photos_limit
  before insert on public.request_photos
  for each row execute function private.check_request_photo_limit();

alter table public.request_photos enable row level security;

revoke all on public.request_photos from anon, authenticated;
grant select, delete on public.request_photos to authenticated;
grant insert (request_id, path) on public.request_photos to authenticated;

create policy request_photos_select on public.request_photos
  for select to authenticated
  using (private.is_request_participant(request_id));

create policy request_photos_insert_draft on public.request_photos
  for insert to authenticated
  with check (private.owns_draft_request(request_id));

create policy request_photos_delete_draft on public.request_photos
  for delete to authenticated
  using (private.owns_draft_request(request_id));

-- Bucket privado: solo jpeg, png o webp, máximo 5 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('request-photos', 'request-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Políticas de Storage. La carpeta se valida con regex UUID antes de castear. El admin no tiene políticas.
create policy request_photos_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'request-photos'
    and case
      when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then private.owns_draft_request(((storage.foldername(name))[1])::uuid)
      else false
    end
  );

create policy request_photos_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'request-photos'
    and case
      when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then private.is_request_participant(((storage.foldername(name))[1])::uuid)
      else false
    end
  );

create policy request_photos_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'request-photos'
    and case
      when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then private.owns_draft_request(((storage.foldername(name))[1])::uuid)
      else false
    end
  );
