-- 0015_workshop_search: búsqueda de talleres en el mapa y perfil del taller (CU-02). Requiere 0004, 0005 y 0014.
-- Sin tablas nuevas: solo funciones `security definer` de lectura para el cliente. Los errores viajan en el mensaje
-- de la excepción (docs/contrato-api.md). Nunca devuelven owner_id, published ni suspended.
-- Formato de `workshops.hours` (cerrado en 0004): { "mon": [{"open":"09:00","close":"18:00"}], ... }, claves mon..sun,
-- de 0 a 2 rangos "HH:MM" por día con open < close; día ausente o [] = cerrado. La hora es la local de Mérida.

-- ¿Está abierto el taller en ese instante? Usa la hora de America/Merida (sin horario de verano desde 2022).
-- Un rango es [open, close): a la hora de cierre ya está cerrado.
create function private.is_workshop_open(p_hours jsonb, p_at timestamptz default now())
returns boolean
language sql
stable
set search_path = ''
as $$
  with t as (select (p_at at time zone 'America/Merida') as local)
  select coalesce(
    exists (
      select 1
        from t,
             jsonb_array_elements(
               coalesce(p_hours -> (array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])[extract(isodow from t.local)::int], '[]'::jsonb)
             ) r
       where (r ->> 'open') <= to_char(t.local, 'HH24:MI')
         and to_char(t.local, 'HH24:MI') < (r ->> 'close')
    ),
    false
  );
$$;

-- Distancia en km entre dos puntos (haversine), con 2 decimales.
create function private.distance_km(p_lat1 double precision, p_lng1 double precision, p_lat2 double precision, p_lng2 double precision)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select round(
    (6371 * 2 * asin(sqrt(least(1,
      power(sin(radians(p_lat2 - p_lat1) / 2), 2)
      + cos(radians(p_lat1)) * cos(radians(p_lat2)) * power(sin(radians(p_lng2 - p_lng1) / 2), 2)
    ))))::numeric,
    2
  );
$$;

-- Busca talleres publicados y no suspendidos (CU-02). Solo el cliente activo.
-- Orden: con ubicación, del más cercano al más lejano; sin ubicación (A1), por calificación y nombre.
-- A2 (sin resultados): devuelve un arreglo vacío. La colonia se busca como subcadena sin distinguir mayúsculas.
create function public.search_workshops(
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
     or (p_max_price is not null and p_max_price <= 0)
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
           where w.published and not w.suspended
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
create function public.get_workshop_profile(
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

  select * into v_w from public.workshops w where w.id = p_workshop_id and w.published and not w.suspended;
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

revoke execute on function public.search_workshops(public.service_type, double precision, double precision, numeric, text, text, numeric, boolean, numeric, integer, integer) from public, anon;
grant execute on function public.search_workshops(public.service_type, double precision, double precision, numeric, text, text, numeric, boolean, numeric, integer, integer) to authenticated;
revoke execute on function public.get_workshop_profile(uuid, double precision, double precision) from public, anon;
grant execute on function public.get_workshop_profile(uuid, double precision, double precision) to authenticated;
