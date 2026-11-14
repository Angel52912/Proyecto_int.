-- 0018_auditoria: correcciones de la auditoría global de seguridad (0001 a 0017). Requiere 0004, 0007, 0011, 0014 y 0015.
-- Nueva migración: no se edita ninguna ya aplicada. Todo se aplica con CREATE OR REPLACE / DROP POLICY, así que los
-- grants de las funciones se conservan.
-- 1. Un artesano desactivado ya no aparece en el mapa ni recibe solicitudes.
-- 2. El recálculo del promedio del taller se serializa (carrera entre dos reseñas o una reseña y un ocultar).
-- 3. Las reseñas ya no exponen client_id y los clientes solo leen las de talleres visibles.
-- 4. respond_quote no acepta presupuestos de un taller suspendido o de un artesano desactivado.

-- ¿El dueño del taller es un usuario activo? (security definer: profiles solo es legible por su dueño bajo RLS)
create function private.workshop_owner_active(p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.active from public.profiles p where p.id = p_owner_id), false);
$$;

-- 1. Visibilidad del taller: el dueño debe estar activo.
drop policy workshops_select_visible on public.workshops;
create policy workshops_select_visible on public.workshops
  for select to authenticated
  using (
    published and not suspended
    and private.workshop_owner_active(owner_id)
    and private.current_user_role() = 'client'
    and private.is_active()
  );

create or replace function private.workshop_accepts_requests(p_workshop_id uuid, p_service public.service_type)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workshops w
     where w.id = p_workshop_id
       and w.published
       and not w.suspended
       and private.workshop_owner_active(w.owner_id)
       and p_service = any (w.services)
  );
$$;

-- Búsqueda y perfil: mismas funciones de 0015 con la condición del dueño activo.
-- Orden: con ubicación, del más cercano al más lejano; sin ubicación (A1), por calificación y nombre.
-- A2 (sin resultados): devuelve un arreglo vacío. La colonia se busca como subcadena sin distinguir mayúsculas.
create or replace function public.search_workshops(
  p_service public.service_type default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_max_distance_km numeric default null,
  p_colonia text default null,
  p_postal_code text default null,
  p_min_rating numeric default null,
  p_open_now boolean default false,
  p_max_price numeric default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role public.user_role;
  v_active boolean;
  v_colonia text := nullif(btrim(coalesce(p_colonia, '')), '');
  v_pattern text;
  v_open boolean := coalesce(p_open_now, false);
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if (p_lat is null) <> (p_lng is null)
     or p_lat not between -90 and 90 or p_lng not between -180 and 180
     or (p_max_distance_km is not null and (p_max_distance_km <= 0 or p_max_distance_km > 500 or p_lat is null))
     or (v_colonia is not null and char_length(v_colonia) > 100)
     or (p_postal_code is not null and p_postal_code !~ '^[0-9]{5}$')
     or (p_min_rating is not null and p_min_rating not between 1 and 5)
     or (p_max_price is not null and (p_max_price <= 0 or p_max_price >= 100000000 or p_max_price = 'NaN'::numeric))
     or p_limit is null or p_limit not between 1 and 100
     or p_offset is null or p_offset < 0 then
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

  if v_colonia is not null then
    v_pattern := '%' || replace(replace(replace(lower(v_colonia), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  select coalesce(jsonb_agg(s.item order by s.n), '[]'::jsonb)
    into v_result
    from (
      select row_number() over (
               order by f.distance_km asc nulls last, f.rating_avg desc nulls last, f.rating_count desc, f.name, f.id
             ) as n,
             jsonb_build_object(
               'id', f.id,
               'name', f.name,
               'address', f.address,
               'colonia', f.colonia,
               'postal_code', f.postal_code,
               'lat', f.lat,
               'lng', f.lng,
               'services', to_jsonb(f.services),
               'hours', f.hours,
               'price_from', f.price_from,
               'rating_avg', f.rating_avg,
               'rating_count', f.rating_count,
               'distance_km', f.distance_km,
               'is_open', f.is_open,
               'profile_photo_path', (
                 select ph.path from public.workshop_photos ph where ph.workshop_id = f.id and ph.kind = 'profile' limit 1
               )
             ) as item
        from (
          select w.*,
                 case when p_lat is null then null else private.distance_km(p_lat, p_lng, w.lat, w.lng) end as distance_km,
                 private.is_workshop_open(w.hours) as is_open
            from public.workshops w
           where w.published and not w.suspended and private.workshop_owner_active(w.owner_id)
             and (p_service is null or p_service = any (w.services))
             and (v_pattern is null or lower(w.colonia) like v_pattern)
             and (p_postal_code is null or w.postal_code = p_postal_code)
             and (p_min_rating is null or w.rating_avg >= p_min_rating)
             and (p_max_price is null or w.price_from <= p_max_price)
        ) f
       where (p_max_distance_km is null or f.distance_km <= p_max_distance_km)
         and (not v_open or f.is_open)
       order by n
       limit p_limit offset p_offset
    ) s;

  return v_result;
end;
$$;

-- Perfil del taller para el cliente (CU-02): datos, calificación, horario, precio "desde", si está abierto y fotos
-- (la de perfil primero y luego los trabajos, del más reciente al más antiguo). Con ubicación opcional devuelve la distancia.
create or replace function public.get_workshop_profile(
  p_workshop_id uuid,
  p_lat double precision default null,
  p_lng double precision default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role public.user_role;
  v_active boolean;
  v_w public.workshops;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_workshop_id is null
     or (p_lat is null) <> (p_lng is null)
     or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
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

  select * into v_w from public.workshops w where w.id = p_workshop_id and w.published and not w.suspended and private.workshop_owner_active(w.owner_id);
  if not found then
    raise exception 'not_found';
  end if;

  return jsonb_build_object(
    'id', v_w.id,
    'name', v_w.name,
    'address', v_w.address,
    'colonia', v_w.colonia,
    'postal_code', v_w.postal_code,
    'lat', v_w.lat,
    'lng', v_w.lng,
    'services', to_jsonb(v_w.services),
    'hours', v_w.hours,
    'price_from', v_w.price_from,
    'rating_avg', v_w.rating_avg,
    'rating_count', v_w.rating_count,
    'distance_km', case when p_lat is null then null else private.distance_km(p_lat, p_lng, v_w.lat, v_w.lng) end,
    'is_open', private.is_workshop_open(v_w.hours),
    'photos', (
      select coalesce(
        jsonb_agg(jsonb_build_object('id', ph.id, 'path', ph.path, 'kind', ph.kind, 'sort', ph.sort)
                  order by (ph.kind = 'profile') desc, ph.created_at desc, ph.id),
        '[]'::jsonb
      )
        from public.workshop_photos ph
       where ph.workshop_id = v_w.id
    )
  );
end;
$$;

-- 2. Promedio del taller sin carreras.
-- Recalcula promedio y conteo del taller desde cero sobre las reseñas no ocultas.
create or replace function private.recalc_workshop_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workshop uuid := case when tg_op = 'DELETE' then old.workshop_id else new.workshop_id end;
begin
  -- Serializa los recálculos del mismo taller: el segundo espera y ya ve la reseña del primero (READ COMMITTED).
  perform 1 from public.workshops x where x.id = v_workshop for update;
  update public.workshops w
     set rating_avg = s.promedio,
         rating_count = s.total
    from (
      select round(avg(r.rating)::numeric, 1) as promedio, count(*)::integer as total
        from public.reviews r
       where r.workshop_id = v_workshop and not r.hidden
    ) s
   where w.id = v_workshop;
  return null;
end;
$$;

-- 4. Aceptar un presupuesto exige un taller disponible.
-- El cliente acepta o rechaza el presupuesto vigente.
-- Aceptar: crea la orden en la misma transacción y avisa a ambas partes.
-- Rechazar (A1): el presupuesto queda `rejected`, la solicitud sigue en `quoted` y el chat abierto
-- para que el artesano envíe otro. El intercambio termina al aceptar o al cancelar la solicitud.
create or replace function public.respond_quote(p_quote_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role public.user_role;
  v_active boolean;
  v_request_id uuid;
  v_request public.service_requests;
  v_quote public.quotes;
  v_order_id uuid;
  v_owner uuid;
  v_suspended boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_quote_id is null or p_accept is null then
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

  select q.request_id into v_request_id from public.quotes q where q.id = p_quote_id;
  if not found then
    raise exception 'not_found';
  end if;
  -- Mismo orden de bloqueo que send_quote y cancel_request: primero la solicitud, luego la cotización.
  select * into v_request from public.service_requests r
   where r.id = v_request_id and r.client_id = v_uid
   for update;
  if not found then
    raise exception 'not_found';
  end if;
  select * into v_quote from public.quotes q where q.id = p_quote_id for update;
  if v_quote.status <> 'sent' or v_request.status <> 'quoted' then
    raise exception 'invalid_state';
  end if;

  select w.owner_id, w.suspended into v_owner, v_suspended from public.workshops w where w.id = v_request.workshop_id;

  if p_accept then
    -- No se acepta un presupuesto de un taller suspendido o de un artesano desactivado: nadie podría mover la orden.
    if v_suspended or not private.workshop_owner_active(v_owner) then
      raise exception 'invalid_state';
    end if;
    update public.quotes set status = 'accepted', responded_at = now() where id = v_quote.id;
    update public.service_requests set status = 'accepted' where id = v_request.id;
    insert into public.orders (quote_id, request_id, client_id, workshop_id, due_date)
    values (v_quote.id, v_request.id, v_request.client_id, v_request.workshop_id, v_quote.delivery_date)
    returning id into v_order_id;
    insert into public.messages (request_id, sender_id, body, kind)
    values (v_request.id, null, 'Presupuesto aceptado. Orden de trabajo creada', 'system');
    insert into public.notifications (user_id, type, payload)
    values
      (v_owner, 'quote_accepted', jsonb_build_object('request_id', v_request.id, 'quote_id', v_quote.id, 'order_id', v_order_id)),
      (v_request.client_id, 'order_created', jsonb_build_object('request_id', v_request.id, 'quote_id', v_quote.id, 'order_id', v_order_id));
    return jsonb_build_object('quote_id', v_quote.id, 'status', 'accepted', 'order_id', v_order_id);
  end if;

  -- La solicitud sigue en `quoted` y el chat abierto: el artesano puede enviar otro presupuesto.
  update public.quotes set status = 'rejected', responded_at = now() where id = v_quote.id;
  insert into public.messages (request_id, sender_id, body, kind)
  values (v_request.id, null, 'Presupuesto rechazado por el cliente', 'system');
  insert into public.notifications (user_id, type, payload)
  values (v_owner, 'quote_rejected', jsonb_build_object('request_id', v_request.id, 'quote_id', v_quote.id));
  return jsonb_build_object('quote_id', v_quote.id, 'status', 'rejected', 'order_id', null);
end;
$$;

-- 3. Reseñas: sin client_id para la API y visibilidad por función. La política usa solo `id` (columna concedida).
-- Ve la reseña: su autor (aunque esté oculta), cualquier cliente o artesano activo si no está oculta y el taller es
-- visible (publicado, no suspendido y con dueño activo), y el artesano dueño del taller si no está oculta.
create function private.can_read_review(p_review_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.reviews r
      join public.workshops w on w.id = r.workshop_id
      join public.profiles p on p.id = (select auth.uid())
     where r.id = p_review_id
       and p.active
       and p.role in ('client', 'craftsman')
       and (
         r.client_id = p.id
         or (
           not r.hidden
           and (
             (w.published and not w.suspended and private.workshop_owner_active(w.owner_id))
             or (p.role = 'craftsman' and w.owner_id = p.id)
           )
         )
       )
  );
$$;

drop policy reviews_select on public.reviews;
create policy reviews_select on public.reviews
  for select to authenticated
  using (private.can_read_review(id));

revoke select on public.reviews from authenticated;
grant select (id, order_id, workshop_id, rating, tags, comment, hidden, created_at) on public.reviews to authenticated;
