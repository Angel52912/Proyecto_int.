-- 0016_admin: administración de la plataforma (CU-08). Requiere 0002, 0004, 0007, 0009, 0011 y 0014.
-- El admin no lee ni escribe tablas: opera solo con funciones `security definer` que validan `role = 'admin'` y
-- `active`, y que escriben la bitácora `admin_actions` en la misma transacción. Las listas NO devuelven el contenido
-- del chat, las fotos privadas, la descripción de las solicitudes, los montos ni los datos de `client_private`.
-- Los errores viajan en el mensaje de la excepción (docs/contrato-api.md).
-- Se registran en la bitácora las acciones que cambian datos; las consultas (listas y panel) no.

create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles (id) on delete restrict,
  action text not null check (char_length(action) between 1 and 50),
  target_table text not null check (char_length(target_table) between 1 and 50),
  target_id uuid not null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create index admin_actions_created_idx on public.admin_actions (created_at desc, id);
create index admin_actions_admin_idx on public.admin_actions (admin_id, created_at desc);

alter table public.admin_actions enable row level security;

-- Sin grants ni políticas: la API no lee ni escribe la tabla (el admin la consulta con admin_list_actions).
revoke all on public.admin_actions from anon, authenticated;

-- Append-only incluso para el superusuario de la aplicación: ningún UPDATE, DELETE ni TRUNCATE.
create function private.block_admin_actions_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'append_only';
end;
$$;

create trigger admin_actions_no_update_delete
  before update or delete on public.admin_actions
  for each row execute function private.block_admin_actions_change();

create trigger admin_actions_no_truncate
  before truncate on public.admin_actions
  for each statement execute function private.block_admin_actions_change();

-- Exige un admin activo y devuelve su id. not_authenticated, not_found, inactive_user o forbidden.
create function private.assert_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role public.user_role;
  v_active boolean;
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
  if v_role is distinct from 'admin' then
    raise exception 'forbidden';
  end if;
  return v_uid;
end;
$$;

-- Valida la paginación: límite de 1 a 100 y desfase >= 0.
create function private.assert_page(p_limit integer, p_offset integer)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset < 0 then
    raise exception 'invalid_input';
  end if;
end;
$$;

-- Patrón LIKE (subcadena, sin distinguir mayúsculas) con `\`, `%` y `_` escapados. Nulo si el texto está vacío.
-- Lanza invalid_input si pasa de 100 caracteres.
create function private.like_pattern(p_text text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_text text := nullif(btrim(coalesce(p_text, '')), '');
begin
  if v_text is null then
    return null;
  end if;
  if char_length(v_text) > 100 then
    raise exception 'invalid_input';
  end if;
  return '%' || replace(replace(replace(lower(v_text), '\', '\\'), '%', '\%'), '_', '\_') || '%';
end;
$$;

-- Motivo opcional de la acción: se recorta; vacío = nulo; máximo 300 caracteres.
create function private.clean_reason(p_reason text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_reason is not null and char_length(v_reason) > 300 then
    raise exception 'invalid_input';
  end if;
  return v_reason;
end;
$$;

-- Escribe la bitácora (en la transacción de la acción).
create function private.log_admin_action(p_admin uuid, p_action text, p_table text, p_target uuid, p_details jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.admin_actions (admin_id, action, target_table, target_id, details)
  values (p_admin, p_action, p_table, p_target, coalesce(p_details, '{}'::jsonb));
$$;

-- Panel con los totales: usuarios, talleres, solicitudes (sin borradores), pedidos y calificación promedio.
create function public.admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  return jsonb_build_object(
    'users', (
      select jsonb_build_object(
        'total', count(*),
        'active', count(*) filter (where p.active),
        'clients', count(*) filter (where p.role = 'client'),
        'craftsmen', count(*) filter (where p.role = 'craftsman'),
        'admins', count(*) filter (where p.role = 'admin'),
        'without_role', count(*) filter (where p.role is null)
      ) from public.profiles p
    ),
    'workshops', (
      select jsonb_build_object(
        'total', count(*),
        'published', count(*) filter (where w.published and not w.suspended),
        'suspended', count(*) filter (where w.suspended)
      ) from public.workshops w
    ),
    'requests', (
      select jsonb_build_object(
        'total', count(*),
        'open', count(*) filter (where r.status = 'open'),
        'quoted', count(*) filter (where r.status = 'quoted'),
        'accepted', count(*) filter (where r.status = 'accepted'),
        'cancelled', count(*) filter (where r.status = 'cancelled')
      ) from public.service_requests r where r.status <> 'draft'
    ),
    'orders', (
      select jsonb_build_object(
        'total', count(*),
        'in_progress', count(*) filter (where o.status = 'in_progress'),
        'ready', count(*) filter (where o.status = 'ready'),
        'delivered', count(*) filter (where o.status = 'delivered'),
        'cancelled', count(*) filter (where o.status = 'cancelled')
      ) from public.orders o
    ),
    'reviews', (
      select jsonb_build_object(
        'count', count(*),
        'rating_avg', round(avg(rv.rating)::numeric, 1)
      ) from public.reviews rv where not rv.hidden
    )
  );
end;
$$;

-- Lista y busca usuarios (por nombre o correo). Devuelve { total, items }. No incluye datos de client_private.
create function public.admin_list_users(
  p_search text default null,
  p_role public.user_role default null,
  p_active boolean default null,
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
  v_pattern text;
  v_result jsonb;
begin
  perform private.assert_admin();
  perform private.assert_page(p_limit, p_offset);
  v_pattern := private.like_pattern(p_search);

  with f as (
    select p.id, p.role, p.full_name, p.active, p.created_at, u.email::text as email
      from public.profiles p
      join auth.users u on u.id = p.id
     where (v_pattern is null or lower(p.full_name) like v_pattern or lower(u.email) like v_pattern)
       and (p_role is null or p.role = p_role)
       and (p_active is null or p.active = p_active)
  ),
  page as (select * from f order by f.created_at desc, f.id limit p_limit offset p_offset)
  select jsonb_build_object(
           'total', (select count(*) from f),
           'items', (
             select coalesce(
               jsonb_agg(jsonb_build_object('id', g.id, 'role', g.role, 'full_name', g.full_name, 'email', g.email,
                                            'active', g.active, 'created_at', g.created_at) order by g.created_at desc, g.id),
               '[]'::jsonb)
               from page g
           )
         )
    into v_result;
  return v_result;
end;
$$;

-- Desactiva o reactiva un usuario (no se eliminan). A1: el admin no puede desactivarse a sí mismo y siempre queda al
-- menos un admin activo. Se bloquean las filas de admin en orden estable para que dos admins no se desactiven a la vez.
create function public.admin_set_user_active(p_user_id uuid, p_active boolean, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid;
  v_reason text;
  v_target public.profiles;
  v_actor_role public.user_role;
  v_actor_active boolean;
  v_remaining integer;
begin
  v_admin := private.assert_admin();
  if p_user_id is null or p_active is null then
    raise exception 'invalid_input';
  end if;
  v_reason := private.clean_reason(p_reason);

  -- Bloqueo estable de todos los admin (por id) y nueva revisión del actor: si otro admin lo desactivó mientras
  -- esperaba, ya no puede actuar.
  perform 1 from public.profiles p where p.role = 'admin' order by p.id for update;
  select p.role, p.active into v_actor_role, v_actor_active from public.profiles p where p.id = v_admin;
  if not v_actor_active then
    raise exception 'inactive_user';
  end if;
  if v_actor_role is distinct from 'admin' then
    raise exception 'forbidden';
  end if;

  select * into v_target from public.profiles p where p.id = p_user_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if not p_active and p_user_id = v_admin then
    raise exception 'forbidden'; -- A1: no puede desactivarse a sí mismo
  end if;
  if v_target.active = p_active then
    raise exception 'invalid_state';
  end if;

  update public.profiles set active = p_active where id = p_user_id;

  select count(*) into v_remaining from public.profiles p where p.role = 'admin' and p.active;
  if v_remaining = 0 then
    raise exception 'invalid_state'; -- A1: siempre queda al menos un admin activo
  end if;

  perform private.log_admin_action(
    v_admin,
    case when p_active then 'user_reactivated' else 'user_deactivated' end,
    'profiles',
    p_user_id,
    jsonb_build_object('role', v_target.role, 'previous_active', v_target.active, 'reason', v_reason)
  );

  return jsonb_build_object('id', p_user_id, 'active', p_active);
end;
$$;

-- Lista talleres con su dueño. Devuelve { total, items }. No incluye fotos ni horario.
create function public.admin_list_workshops(
  p_search text default null,
  p_published boolean default null,
  p_suspended boolean default null,
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
  v_pattern text;
  v_result jsonb;
begin
  perform private.assert_admin();
  perform private.assert_page(p_limit, p_offset);
  v_pattern := private.like_pattern(p_search);

  with f as (
    select w.id, w.owner_id, o.full_name as owner_name, w.name, w.colonia, w.services, w.published, w.suspended,
           w.rating_avg, w.rating_count, w.created_at
      from public.workshops w
      join public.profiles o on o.id = w.owner_id
     where (v_pattern is null or lower(coalesce(w.name, '')) like v_pattern or lower(coalesce(w.colonia, '')) like v_pattern
            or lower(o.full_name) like v_pattern)
       and (p_published is null or w.published = p_published)
       and (p_suspended is null or w.suspended = p_suspended)
  ),
  page as (select * from f order by f.created_at desc, f.id limit p_limit offset p_offset)
  select jsonb_build_object(
           'total', (select count(*) from f),
           'items', (
             select coalesce(
               jsonb_agg(jsonb_build_object('id', g.id, 'owner_id', g.owner_id, 'owner_name', g.owner_name, 'name', g.name,
                                            'colonia', g.colonia, 'services', to_jsonb(g.services), 'published', g.published,
                                            'suspended', g.suspended, 'rating_avg', g.rating_avg, 'rating_count', g.rating_count,
                                            'created_at', g.created_at) order by g.created_at desc, g.id),
               '[]'::jsonb)
               from page g
           )
         )
    into v_result;
  return v_result;
end;
$$;

-- Suspende (sale del mapa y no recibe solicitudes ni presupuestos) o reactiva un taller. Avisa al dueño.
create function public.admin_set_workshop_suspended(p_workshop_id uuid, p_suspended boolean, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid;
  v_reason text;
  v_workshop public.workshops;
begin
  v_admin := private.assert_admin();
  if p_workshop_id is null or p_suspended is null then
    raise exception 'invalid_input';
  end if;
  v_reason := private.clean_reason(p_reason);

  select * into v_workshop from public.workshops w where w.id = p_workshop_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_workshop.suspended = p_suspended then
    raise exception 'invalid_state';
  end if;

  update public.workshops set suspended = p_suspended where id = p_workshop_id;

  perform private.log_admin_action(
    v_admin,
    case when p_suspended then 'workshop_suspended' else 'workshop_reactivated' end,
    'workshops',
    p_workshop_id,
    jsonb_build_object('owner_id', v_workshop.owner_id, 'published', v_workshop.published, 'reason', v_reason)
  );
  insert into public.notifications (user_id, type, payload)
  values (v_workshop.owner_id, case when p_suspended then 'workshop_suspended' else 'workshop_reactivated' end,
          jsonb_build_object('workshop_id', p_workshop_id));

  return jsonb_build_object('id', p_workshop_id, 'suspended', p_suspended);
end;
$$;

-- Lista reseñas para moderar (con el comentario). Devuelve { total, items }.
create function public.admin_list_reviews(
  p_workshop_id uuid default null,
  p_hidden boolean default null,
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
  v_result jsonb;
begin
  perform private.assert_admin();
  perform private.assert_page(p_limit, p_offset);

  with f as (
    select r.id, r.order_id, r.workshop_id, w.name as workshop_name, r.client_id, r.rating, r.tags, r.comment, r.hidden, r.created_at
      from public.reviews r
      join public.workshops w on w.id = r.workshop_id
     where (p_workshop_id is null or r.workshop_id = p_workshop_id)
       and (p_hidden is null or r.hidden = p_hidden)
  ),
  page as (select * from f order by f.created_at desc, f.id limit p_limit offset p_offset)
  select jsonb_build_object(
           'total', (select count(*) from f),
           'items', (
             select coalesce(
               jsonb_agg(jsonb_build_object('id', g.id, 'order_id', g.order_id, 'workshop_id', g.workshop_id,
                                            'workshop_name', g.workshop_name, 'client_id', g.client_id, 'rating', g.rating,
                                            'tags', to_jsonb(g.tags), 'comment', g.comment, 'hidden', g.hidden,
                                            'created_at', g.created_at) order by g.created_at desc, g.id),
               '[]'::jsonb)
               from page g
           )
         )
    into v_result;
  return v_result;
end;
$$;

-- Oculta o restaura una reseña. El trigger de reviews recalcula el promedio del taller sobre las no ocultas.
create function public.admin_set_review_hidden(p_review_id uuid, p_hidden boolean, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid;
  v_reason text;
  v_review public.reviews;
  v_workshop public.workshops;
begin
  v_admin := private.assert_admin();
  if p_review_id is null or p_hidden is null then
    raise exception 'invalid_input';
  end if;
  v_reason := private.clean_reason(p_reason);

  select * into v_review from public.reviews r where r.id = p_review_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_review.hidden = p_hidden then
    raise exception 'invalid_state';
  end if;

  update public.reviews set hidden = p_hidden where id = p_review_id;
  select * into v_workshop from public.workshops w where w.id = v_review.workshop_id;

  perform private.log_admin_action(
    v_admin,
    case when p_hidden then 'review_hidden' else 'review_restored' end,
    'reviews',
    p_review_id,
    jsonb_build_object('workshop_id', v_review.workshop_id, 'rating', v_review.rating, 'reason', v_reason)
  );

  return jsonb_build_object(
    'id', p_review_id,
    'hidden', p_hidden,
    'workshop_id', v_review.workshop_id,
    'rating_avg', v_workshop.rating_avg,
    'rating_count', v_workshop.rating_count
  );
end;
$$;

-- Solicitudes (sin borradores) de solo lectura: estatus y fechas. Sin descripción, fotos ni chat. { total, items }.
create function public.admin_list_requests(
  p_status public.request_status default null,
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
  v_result jsonb;
begin
  perform private.assert_admin();
  perform private.assert_page(p_limit, p_offset);
  if p_status = 'draft' then
    raise exception 'invalid_input';
  end if;

  with f as (
    select r.id, r.client_id, r.workshop_id, w.name as workshop_name, r.service_type, r.status, r.submitted_at, r.created_at, r.updated_at
      from public.service_requests r
      join public.workshops w on w.id = r.workshop_id
     where r.status <> 'draft'
       and (p_status is null or r.status = p_status)
  ),
  page as (select * from f order by f.created_at desc, f.id limit p_limit offset p_offset)
  select jsonb_build_object(
           'total', (select count(*) from f),
           'items', (
             select coalesce(
               jsonb_agg(jsonb_build_object('id', g.id, 'client_id', g.client_id, 'workshop_id', g.workshop_id,
                                            'workshop_name', g.workshop_name, 'service_type', g.service_type, 'status', g.status,
                                            'submitted_at', g.submitted_at, 'created_at', g.created_at,
                                            'updated_at', g.updated_at) order by g.created_at desc, g.id),
               '[]'::jsonb)
               from page g
           )
         )
    into v_result;
  return v_result;
end;
$$;

-- Pedidos de solo lectura: fase, estatus y fechas. Sin montos, fotos de avance ni PIN. { total, items }.
create function public.admin_list_orders(
  p_status public.order_status default null,
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
  v_result jsonb;
begin
  perform private.assert_admin();
  perform private.assert_page(p_limit, p_offset);

  with f as (
    select o.id, o.request_id, o.client_id, o.workshop_id, w.name as workshop_name, o.phase, o.status, o.due_date,
           o.ready_at, o.delivered_at, o.created_at, o.updated_at
      from public.orders o
      join public.workshops w on w.id = o.workshop_id
     where p_status is null or o.status = p_status
  ),
  page as (select * from f order by f.created_at desc, f.id limit p_limit offset p_offset)
  select jsonb_build_object(
           'total', (select count(*) from f),
           'items', (
             select coalesce(
               jsonb_agg(jsonb_build_object('id', g.id, 'request_id', g.request_id, 'client_id', g.client_id,
                                            'workshop_id', g.workshop_id, 'workshop_name', g.workshop_name, 'phase', g.phase,
                                            'status', g.status, 'due_date', g.due_date, 'ready_at', g.ready_at,
                                            'delivered_at', g.delivered_at, 'created_at', g.created_at,
                                            'updated_at', g.updated_at) order by g.created_at desc, g.id),
               '[]'::jsonb)
               from page g
           )
         )
    into v_result;
  return v_result;
end;
$$;

-- Bitácora: del más reciente al más antiguo. { total, items }. Consultarla no genera otra entrada.
create function public.admin_list_actions(
  p_admin_id uuid default null,
  p_action text default null,
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
  v_action text := nullif(btrim(coalesce(p_action, '')), '');
  v_result jsonb;
begin
  perform private.assert_admin();
  perform private.assert_page(p_limit, p_offset);
  if v_action is not null and char_length(v_action) > 50 then
    raise exception 'invalid_input';
  end if;

  with f as (
    select a.id, a.admin_id, p.full_name as admin_name, a.action, a.target_table, a.target_id, a.details, a.created_at
      from public.admin_actions a
      join public.profiles p on p.id = a.admin_id
     where (p_admin_id is null or a.admin_id = p_admin_id)
       and (v_action is null or a.action = v_action)
  ),
  page as (select * from f order by f.created_at desc, f.id limit p_limit offset p_offset)
  select jsonb_build_object(
           'total', (select count(*) from f),
           'items', (
             select coalesce(
               jsonb_agg(jsonb_build_object('id', g.id, 'admin_id', g.admin_id, 'admin_name', g.admin_name, 'action', g.action,
                                            'target_table', g.target_table, 'target_id', g.target_id, 'details', g.details,
                                            'created_at', g.created_at) order by g.created_at desc, g.id),
               '[]'::jsonb)
               from page g
           )
         )
    into v_result;
  return v_result;
end;
$$;

revoke execute on function public.admin_dashboard() from public, anon;
grant execute on function public.admin_dashboard() to authenticated;
revoke execute on function public.admin_list_users(text, public.user_role, boolean, integer, integer) from public, anon;
grant execute on function public.admin_list_users(text, public.user_role, boolean, integer, integer) to authenticated;
revoke execute on function public.admin_set_user_active(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_user_active(uuid, boolean, text) to authenticated;
revoke execute on function public.admin_list_workshops(text, boolean, boolean, integer, integer) from public, anon;
grant execute on function public.admin_list_workshops(text, boolean, boolean, integer, integer) to authenticated;
revoke execute on function public.admin_set_workshop_suspended(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_workshop_suspended(uuid, boolean, text) to authenticated;
revoke execute on function public.admin_list_reviews(uuid, boolean, integer, integer) from public, anon;
grant execute on function public.admin_list_reviews(uuid, boolean, integer, integer) to authenticated;
revoke execute on function public.admin_set_review_hidden(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_review_hidden(uuid, boolean, text) to authenticated;
revoke execute on function public.admin_list_requests(public.request_status, integer, integer) from public, anon;
grant execute on function public.admin_list_requests(public.request_status, integer, integer) to authenticated;
revoke execute on function public.admin_list_orders(public.order_status, integer, integer) from public, anon;
grant execute on function public.admin_list_orders(public.order_status, integer, integer) to authenticated;
revoke execute on function public.admin_list_actions(uuid, text, integer, integer) from public, anon;
grant execute on function public.admin_list_actions(uuid, text, integer, integer) to authenticated;
