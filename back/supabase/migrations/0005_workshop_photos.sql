-- 0005_workshop_photos: fotos del taller (perfil y trabajos) y bucket público (CU-07). Requiere 0004_workshops.
-- Ruta en Storage: {workshop_id}/{uuid}. Las fotos del taller son públicas.

create type public.workshop_photo_kind as enum ('profile', 'work');

create table public.workshop_photos (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops (id) on delete cascade,
  path text not null unique,
  kind public.workshop_photo_kind not null default 'work',
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  -- La ruta debe ser {workshop_id}/{uuid}: nadie registra fotos de otro taller.
  constraint workshop_photos_path_format check (
    path ~ ('^' || workshop_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  )
);

create index workshop_photos_workshop_idx on public.workshop_photos (workshop_id, sort);
-- Una sola foto de perfil por taller.
create unique index workshop_photos_one_profile on public.workshop_photos (workshop_id) where kind = 'profile';

-- Máximo 10 fotos de trabajos por taller.
create function private.check_workshop_photo_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'work'
     and (select count(*) from public.workshop_photos f where f.workshop_id = new.workshop_id and f.kind = 'work') >= 10 then
    raise exception 'limit_reached';
  end if;
  return new;
end;
$$;

create trigger workshop_photos_limit
  before insert on public.workshop_photos
  for each row execute function private.check_workshop_photo_limit();

alter table public.workshop_photos enable row level security;

revoke all on public.workshop_photos from anon, authenticated;
grant select, delete on public.workshop_photos to authenticated;
grant insert (workshop_id, path, kind, sort) on public.workshop_photos to authenticated;
grant update (sort) on public.workshop_photos to authenticated;

-- SELECT: lo que el usuario ya puede ver del taller (RLS de workshops: cliente ve publicados; dueño, el suyo).
create policy workshop_photos_select on public.workshop_photos
  for select to authenticated
  using (exists (select 1 from public.workshops w where w.id = workshop_photos.workshop_id));

create policy workshop_photos_insert_owner on public.workshop_photos
  for insert to authenticated
  with check (private.owns_workshop(workshop_id));

create policy workshop_photos_update_owner on public.workshop_photos
  for update to authenticated
  using (private.owns_workshop(workshop_id))
  with check (private.owns_workshop(workshop_id));

create policy workshop_photos_delete_owner on public.workshop_photos
  for delete to authenticated
  using (private.owns_workshop(workshop_id));

-- Bucket público: solo jpeg, png o webp, máximo 5 MB. Sin política de SELECT (no se lista; se lee por URL pública).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('workshop-photos', 'workshop-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Políticas de Storage: solo el dueño escribe en la carpeta de su taller. La ruta se valida con regex antes de castear.
create policy workshop_photos_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'workshop-photos'
    and case
      when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then private.owns_workshop(((storage.foldername(name))[1])::uuid)
      else false
    end
  );

create policy workshop_photos_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'workshop-photos'
    and case
      when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then private.owns_workshop(((storage.foldername(name))[1])::uuid)
      else false
    end
  );
