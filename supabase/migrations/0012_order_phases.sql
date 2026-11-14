-- 0012_order_phases: fases del pedido, fotos de avance y aviso de "listo para entrega" (CU-05). Requiere 0011.
-- order_updates es append-only y solo se escribe con advance_phase (`security definer`); el usuario solo lee.
-- Ruta en Storage (bucket privado progress-photos): {order_id}/{uuid}. Los errores viajan en el mensaje de la excepción.

create table public.order_updates (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  phase smallint not null check (phase between 1 and 4),
  photo_path text not null unique,
  note text check (note is null or char_length(note) between 1 and 500),
  corrected boolean not null default false,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  -- La ruta debe ser {order_id}/{uuid}: nadie registra la foto de otro pedido.
  constraint order_updates_path_format check (
    photo_path ~ ('^' || order_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  ),
  -- Una corrección exige nota.
  constraint order_updates_corrected_note check (not corrected or note is not null)
);

create index order_updates_order_idx on public.order_updates (order_id, created_at);

alter table public.order_updates enable row level security;

-- Solo lectura: sin INSERT, UPDATE ni DELETE para ningún rol de la API (append-only).
revoke all on public.order_updates from anon, authenticated;
grant select on public.order_updates to authenticated;

create policy order_updates_select_participant on public.order_updates
  for select to authenticated
  using (private.is_order_participant(order_id));

-- ¿El usuario es el artesano dueño del taller de la orden, activo, con el taller no suspendido y la orden en curso?
create function private.is_active_order_craftsman(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.orders o
      join public.workshops w on w.id = o.workshop_id
      join public.profiles p on p.id = (select auth.uid())
     where o.id = p_order_id
       and o.status = 'in_progress'
       and p.active
       and p.role = 'craftsman'
       and w.owner_id = p.id
       and not w.suspended
  );
$$;

revoke all on function private.is_active_order_craftsman(uuid) from public, anon;
grant execute on function private.is_active_order_craftsman(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.order_updates;
  end if;
end;
$$;

-- Bucket privado: solo jpeg, png o webp, máximo 5 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Políticas de Storage. La carpeta se valida con regex UUID antes de castear. El admin no tiene políticas.
-- Sube el artesano dueño con el pedido `in_progress`; ven los participantes.
create policy progress_photos_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'progress-photos'
    and case
      when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then private.is_active_order_craftsman(((storage.foldername(name))[1])::uuid)
      else false
    end
  );

create policy progress_photos_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'progress-photos'
    and case
      when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then private.is_order_participant(((storage.foldername(name))[1])::uuid)
      else false
    end
  );

-- Solo se puede borrar un archivo huérfano (sin avance registrado), p. ej. si advance_phase falló tras la subida.
create policy progress_photos_storage_delete_orphan on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'progress-photos'
    and case
      when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then private.is_active_order_craftsman(((storage.foldername(name))[1])::uuid)
             and not exists (select 1 from public.order_updates u where u.photo_path = name)
      else false
    end
  );

-- Cambia la fase del pedido (CU-05). Solo el artesano dueño, con el pedido `in_progress`.
-- Avanzar es de una en una (`phase + 1`). Un salto o un retroceso (A1) exige p_confirm = true y nota, y se marca `corrected`.
-- La foto de avance es obligatoria siempre: debe existir en el bucket progress-photos con la ruta {order_id}/{uuid}.
create function public.advance_phase(
  p_order_id uuid,
  p_to_phase integer,
  p_photo_path text,
  p_note text default null,
  p_confirm boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role public.user_role;
  v_active boolean;
  v_order public.orders;
  v_suspended boolean;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_corrected boolean;
  v_update public.order_updates;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_order_id is null or p_to_phase is null or p_to_phase not between 1 and 4
     or (v_note is not null and char_length(v_note) > 500) then
    raise exception 'invalid_input';
  end if;
  select p.role, p.active into v_role, v_active from public.profiles p where p.id = v_uid;
  if not found then
    raise exception 'not_found';
  end if;
  if not v_active then
    raise exception 'inactive_user';
  end if;
  if v_role is distinct from 'craftsman' then
    raise exception 'forbidden';
  end if;

  -- Bloquea la orden: dos cambios simultáneos se serializan.
  select o.* into v_order
    from public.orders o
    join public.workshops w on w.id = o.workshop_id
   where o.id = p_order_id and w.owner_id = v_uid
   for update of o;
  if not found then
    raise exception 'not_found';
  end if;
  select w.suspended into v_suspended from public.workshops w where w.id = v_order.workshop_id;
  if v_suspended then
    raise exception 'forbidden';
  end if;
  if v_order.status <> 'in_progress' then
    raise exception 'invalid_state';
  end if;
  if p_to_phase = v_order.phase then
    raise exception 'invalid_input';
  end if;

  -- Foto obligatoria: ruta vacía o archivo inexistente en Storage = photo_required.
  if p_photo_path is null or btrim(p_photo_path) = '' then
    raise exception 'photo_required';
  end if;
  if p_photo_path !~ ('^' || v_order.id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
    raise exception 'invalid_input';
  end if;
  if not exists (select 1 from storage.objects s where s.bucket_id = 'progress-photos' and s.name = p_photo_path) then
    raise exception 'photo_required';
  end if;
  if exists (select 1 from public.order_updates u where u.photo_path = p_photo_path) then
    raise exception 'invalid_input';
  end if;

  v_corrected := p_to_phase <> v_order.phase + 1;
  if v_corrected and (p_confirm is not true or v_note is null) then
    raise exception 'confirmation_required';
  end if;

  update public.orders set phase = p_to_phase where id = v_order.id;
  insert into public.order_updates (order_id, phase, photo_path, note, corrected, created_by)
  values (v_order.id, p_to_phase, p_photo_path, v_note, v_corrected, v_uid)
  returning * into v_update;

  insert into public.notifications (user_id, type, payload)
  values (v_order.client_id, 'order_phase_changed',
    jsonb_build_object('order_id', v_order.id, 'request_id', v_order.request_id, 'phase', p_to_phase, 'corrected', v_corrected));

  return jsonb_build_object(
    'order_id', v_order.id,
    'phase', p_to_phase,
    'status', v_order.status,
    'update', jsonb_build_object(
      'id', v_update.id,
      'order_id', v_update.order_id,
      'phase', v_update.phase,
      'photo_path', v_update.photo_path,
      'note', v_update.note,
      'corrected', v_update.corrected,
      'created_by', v_update.created_by,
      'created_at', v_update.created_at
    )
  );
end;
$$;

-- Marca el pedido "Listo para entrega" (CU-05). Exige la fase 4. Avisa al cliente.
-- El PIN de entrega lo genera y revela CU-06; aquí no se toca.
create function public.mark_ready(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role public.user_role;
  v_active boolean;
  v_order public.orders;
  v_suspended boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_order_id is null then
    raise exception 'invalid_input';
  end if;
  select p.role, p.active into v_role, v_active from public.profiles p where p.id = v_uid;
  if not found then
    raise exception 'not_found';
  end if;
  if not v_active then
    raise exception 'inactive_user';
  end if;
  if v_role is distinct from 'craftsman' then
    raise exception 'forbidden';
  end if;

  select o.* into v_order
    from public.orders o
    join public.workshops w on w.id = o.workshop_id
   where o.id = p_order_id and w.owner_id = v_uid
   for update of o;
  if not found then
    raise exception 'not_found';
  end if;
  select w.suspended into v_suspended from public.workshops w where w.id = v_order.workshop_id;
  if v_suspended then
    raise exception 'forbidden';
  end if;
  if v_order.status <> 'in_progress' or v_order.phase <> 4 then
    raise exception 'invalid_state';
  end if;

  update public.orders set status = 'ready', ready_at = now() where id = v_order.id
  returning * into v_order;

  insert into public.messages (request_id, sender_id, body, kind)
  values (v_order.request_id, null, 'Tu pedido está listo para entrega', 'system');
  insert into public.notifications (user_id, type, payload)
  values (v_order.client_id, 'order_ready', jsonb_build_object('order_id', v_order.id, 'request_id', v_order.request_id));

  return jsonb_build_object('order_id', v_order.id, 'status', v_order.status, 'phase', v_order.phase, 'ready_at', v_order.ready_at);
end;
$$;

revoke execute on function public.advance_phase(uuid, integer, text, text, boolean) from public, anon;
grant execute on function public.advance_phase(uuid, integer, text, text, boolean) to authenticated;
revoke execute on function public.mark_ready(uuid) from public, anon;
grant execute on function public.mark_ready(uuid) to authenticated;
