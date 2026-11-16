-- 0019_funcionalidad: lo que faltaba en el backend para conectar las pantallas del frontend. Requiere 0015 y 0018.
-- 1. search_workshops: búsqueda por texto (nombre o colonia) y orden en el servidor (distance, rating o price).
--    Cambia la firma (2 parámetros nuevos al final), por eso se borra la función anterior; los grants se repiten abajo.
-- 2. get_my_workshop_stats y list_my_workshop_reviews: la pantalla "Mi taller" del artesano.
-- Los errores viajan en el mensaje de la excepción (docs/contrato-api.md).

drop function public.search_workshops(public.service_type, double precision, double precision, numeric, text, text, numeric, boolean, numeric, integer, integer);

-- Busca talleres publicados, no suspendidos y con dueño activo (CU-02). Solo el cliente activo.
-- p_search: subcadena (sin distinguir mayúsculas) en el nombre o la colonia del taller.
-- p_order: distance (exige ubicación), rating o price (precio "desde" ascendente). Por defecto: distance con
-- ubicación y rating sin ella. En todos los casos desempata por calificación, número de reseñas y nombre.
-- A2 (sin resultados): devuelve un arreglo vacío.
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
  p_offset integer default 0,
  p_search text default null,
  p_order text default null
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
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_search_pattern text;
  v_order text := coalesce(p_order, case when p_lat is null then 'rating' else 'distance' end);
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
     or p_offset is null or p_offset < 0
     or (v_search is not null and char_length(v_search) > 100)
     or v_order not in ('distance', 'rating', 'price')
     or (v_order = 'distance' and p_lat is null) then
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

  if v_search is not null then
    v_search_pattern := '%' || replace(replace(replace(lower(v_search), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  select coalesce(jsonb_agg(s.item order by s.n), '[]'::jsonb)
    into v_result
    from (
      select row_number() over (
               order by (case v_order when 'distance' then f.distance_km when 'price' then f.price_from end) asc nulls last,
                        f.rating_avg desc nulls last, f.rating_count desc, f.name, f.id
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
             and (v_search_pattern is null or lower(w.name) like v_search_pattern or lower(w.colonia) like v_search_pattern)
             and (p_postal_code is null or w.postal_code = p_postal_code)
             and (p_min_rating is null or w.rating_avg >= p_min_rating)
             and (p_max_price is null or w.price_from <= p_max_price)
        ) f
       where (p_max_distance_km is null or f.distance_km <= p_max_distance_km)
         and (not v_open or f.is_open)
       order by n
       limit p_limit offset p_offset

revoke execute on function public.search_workshops(public.service_type, double precision, double precision, numeric, text, text, numeric, boolean, numeric, integer, integer, text, text) from public, anon;
grant execute on function public.search_workshops(public.service_type, double precision, double precision, numeric, text, text, numeric, boolean, numeric, integer, integer, text, text) to authenticated;

-- "Mi taller" del artesano (CU-07): calificación, pedidos y puntualidad. Solo el artesano activo con taller.
-- on_time_pct: % de pedidos entregados en o antes de la fecha prometida (hora de Mérida); nulo si no hay entregados.
create function public.get_my_workshop_stats()
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
  v_workshop public.workshops;
  v_orders jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
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
  select * into v_workshop from public.workshops w where w.owner_id = v_uid;
  if not found then
    raise exception 'not_found';
  end if;

  select jsonb_build_object(
           'total', count(*),
           'in_progress', count(*) filter (where o.status = 'in_progress'),
           'ready', count(*) filter (where o.status = 'ready'),
           'delivered', count(*) filter (where o.status = 'delivered'),
           'on_time_pct', case
             when count(*) filter (where o.status = 'delivered') = 0 then null
             else round(
               100.0 * count(*) filter (where o.status = 'delivered' and (o.delivered_at at time zone 'America/Merida')::date <= o.due_date)
               / count(*) filter (where o.status = 'delivered'), 1)
           end
         )
    into v_orders
    from public.orders o
   where o.workshop_id = v_workshop.id;

  return jsonb_build_object(
    'workshop_id', v_workshop.id,
    'published', v_workshop.published,
    'suspended', v_workshop.suspended,
    'rating_avg', v_workshop.rating_avg,
    'rating_count', v_workshop.rating_count,
    'orders', v_orders,
    'requests', (
      select jsonb_build_object(
        'open', count(*) filter (where r.status = 'open'),
        'quoted', count(*) filter (where r.status = 'quoted'),
        'accepted', count(*) filter (where r.status = 'accepted'),
        'cancelled', count(*) filter (where r.status = 'cancelled')
      )
      from public.service_requests r
      where r.workshop_id = v_workshop.id and r.status <> 'draft'
    )
  );
end;
$$;

-- Reseñas no ocultas del taller propio, de la más reciente a la más antigua. No expone quién las escribió.
-- Devuelve { total, items: [{ id, rating, tags, comment, created_at }] }.
create function public.list_my_workshop_reviews(p_limit integer default 20, p_offset integer default 0)
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
  v_workshop uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset < 0 then
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
  select w.id into v_workshop from public.workshops w where w.owner_id = v_uid;
  if not found then
    raise exception 'not_found';
  end if;

  return (
    with f as (
      select r.id, r.rating, r.tags, r.comment, r.created_at
        from public.reviews r
       where r.workshop_id = v_workshop and not r.hidden
    ),
    page as (select * from f order by f.created_at desc, f.id limit p_limit offset p_offset)
    select jsonb_build_object(
             'total', (select count(*) from f),
             'items', (
               select coalesce(
                 jsonb_agg(jsonb_build_object('id', g.id, 'rating', g.rating, 'tags', to_jsonb(g.tags), 'comment', g.comment,
                                              'created_at', g.created_at) order by g.created_at desc, g.id),
                 '[]'::jsonb)
                 from page g
             )
           )
  );
end;
$$;

revoke execute on function public.get_my_workshop_stats() from public, anon;
grant execute on function public.get_my_workshop_stats() to authenticated;
revoke execute on function public.list_my_workshop_reviews(integer, integer) from public, anon;
grant execute on function public.list_my_workshop_reviews(integer, integer) to authenticated;
