-- 0020_endurecimiento: puntos pendientes de la auditoría global (0001 a 0018). Requiere 0005, 0008, 0009, 0010, 0011, 0012 y 0017.
-- 1. Storage: cuota de archivos por carpeta en workshop-photos, request-photos y progress-photos (el tope de las
--    tablas no frenaba subir archivos sueltos), rutas de un solo nivel ({id}/{uuid}) y artesano suspendido sin subir.
-- 2. submit_request exige que la foto exista de verdad en Storage (no solo la fila en request_photos).
-- 3. Límite de tasa: 30 mensajes por minuto por usuario, 10 presupuestos por hora por solicitud y 10 borradores por
--    cliente. Los errores viajan en el mensaje (rate_limited, limit_reached; docs/contrato-api.md).

-- Cuenta los archivos de una carpeta de un bucket (security definer: workshop-photos no tiene política de SELECT).
create function private.storage_folder_count(p_bucket text, p_folder text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
    from storage.objects o
   where o.bucket_id = p_bucket and (storage.foldername(o.name))[1] = p_folder;
$$;

-- ¿Puede el usuario subir fotos al taller? Artesano activo dueño y con el taller no suspendido.
create function private.can_manage_workshop_photos(p_workshop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.owns_workshop(p_workshop_id)
     and not exists (select 1 from public.workshops w where w.id = p_workshop_id and w.suspended);
$$;

-- 1. Storage ---------------------------------------------------------------------------------------------------

-- workshop-photos: 1 de perfil + 10 de trabajos + 1 de margen por taller.
drop policy workshop_photos_storage_insert on storage.objects;
create policy workshop_photos_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'workshop-photos'
    and array_length(storage.foldername(name), 1) = 1
    and case
      when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then private.can_manage_workshop_photos(((storage.foldername(name))[1])::uuid)
             and private.storage_folder_count('workshop-photos', (storage.foldername(name))[1]) < 12
      else false
    end
  );

drop policy workshop_photos_insert_owner on public.workshop_photos;
create policy workshop_photos_insert_owner on public.workshop_photos
  for insert to authenticated
  with check (private.can_manage_workshop_photos(workshop_id));

-- request-photos: 5 fotos por solicitud + 1 de margen.
drop policy request_photos_storage_insert on storage.objects;
create policy request_photos_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'request-photos'
    and array_length(storage.foldername(name), 1) = 1
    and case
      when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then private.owns_draft_request(((storage.foldername(name))[1])::uuid)
             and private.storage_folder_count('request-photos', (storage.foldername(name))[1]) < 6
      else false
    end
  );

-- progress-photos: una foto por cambio de fase; 40 por pedido alcanzan con las correcciones.
drop policy progress_photos_storage_insert on storage.objects;
create policy progress_photos_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'progress-photos'
    and array_length(storage.foldername(name), 1) = 1
    and case
      when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then private.is_active_order_craftsman(((storage.foldername(name))[1])::uuid)
             and private.storage_folder_count('progress-photos', (storage.foldername(name))[1]) < 40
      else false
    end
  );

-- avatars: solo rutas {uid}/{uuid} (sin subcarpetas) y como máximo 3 archivos por usuario.
drop policy avatars_storage_insert on storage.objects;
create policy avatars_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and array_length(storage.foldername(name), 1) = 1
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.is_active()
    and private.current_user_role() in ('client', 'craftsman')
    and private.storage_folder_count('avatars', (storage.foldername(name))[1]) < 3
  );

-- 2. submit_request con la foto comprobada en Storage -----------------------------------------------------------
-- Envía la solicitud: `draft` -> `open`. Exige foto, taller disponible y máximo 5 activas (open o quoted).
create or replace function public.submit_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role public.user_role;
  v_active boolean;
  v_request public.service_requests;
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_request_id is null then
    raise exception 'invalid_input';
  end if;
  select p.role, p.active into v_role, v_active from public.profiles p where p.id = v_uid;
  if not found then
    raise exception 'not_found';
  end if;
  if not v_active then
    raise exception 'inactive_user';
  end if;
  if v_role is distinct from 'client' then
    raise exception 'forbidden';
  end if;

  -- Bloquea la fila para que dos envíos simultáneos no rebasen el límite.
  select * into v_request from public.service_requests r
   where r.id = p_request_id and r.client_id = v_uid
   for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_request.status <> 'draft' then
    raise exception 'invalid_state';
  end if;
  -- La foto debe existir de verdad en Storage, no solo como fila de request_photos.
  if not exists (
    select 1 from public.request_photos f
      join storage.objects o on o.bucket_id = 'request-photos' and o.name = f.path
     where f.request_id = v_request.id
  ) then
    raise exception 'photo_required';
  end if;
  if not private.workshop_accepts_requests(v_request.workshop_id, v_request.service_type) then
    raise exception 'invalid_state';
  end if;
  -- Serializa los envíos del mismo cliente antes de contar sus activas.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  if (select count(*) from public.service_requests r
       where r.client_id = v_uid and r.status in ('open', 'quoted')) >= 5 then
    raise exception 'limit_reached';
  end if;

  update public.service_requests
     set status = 'open', submitted_at = now()
   where id = v_request.id;

  select w.owner_id into v_owner from public.workshops w where w.id = v_request.workshop_id;
  insert into public.messages (request_id, sender_id, body, kind)
  values (v_request.id, null, 'Solicitud enviada', 'system');
  insert into public.notifications (user_id, type, payload)
  values (v_owner, 'request_received', jsonb_build_object('request_id', v_request.id));

  return jsonb_build_object('id', v_request.id, 'status', 'open');
end;
$$;


-- 3. Límite de tasa -------------------------------------------------------------------------------------------

-- Mensajes: 30 por minuto por usuario (los de sistema no cuentan: sender_id nulo).
create index messages_sender_idx on public.messages (sender_id, created_at) where sender_id is not null;

create function private.limit_message_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.sender_id is not null
     and (select count(*) from public.messages m
           where m.sender_id = new.sender_id and m.created_at > now() - interval '1 minute') >= 30 then
    raise exception 'rate_limited';
  end if;
  return new;
end;
$$;

create trigger messages_rate_limit
  before insert on public.messages
  for each row execute function private.limit_message_rate();

-- Presupuestos: 10 por hora por solicitud (cada rectificación crea uno y genera tarjeta y notificación).
create function private.limit_quote_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.quotes q
       where q.request_id = new.request_id and q.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'rate_limited';
  end if;
  return new;
end;
$$;

create trigger quotes_rate_limit
  before insert on public.quotes
  for each row execute function private.limit_quote_rate();

-- Borradores: como máximo 10 por cliente (hay un borrador por taller; sin tope se podrían crear sin fin).
create function private.limit_draft_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'draft'
     and (select count(*) from public.service_requests r where r.client_id = new.client_id and r.status = 'draft') >= 10 then
    raise exception 'limit_reached';
  end if;
  return new;
end;
$$;

create trigger service_requests_draft_limit
  before insert on public.service_requests
  for each row execute function private.limit_draft_count();
