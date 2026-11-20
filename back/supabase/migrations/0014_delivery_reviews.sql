-- 0014_delivery_reviews: entrega con PIN y calificación (CU-06). Requiere 0004, 0009, 0011, 0012 y 0013.
-- El PIN vive en private.order_pins (0013). reviews solo se escribe con create_review (`security definer`).
-- Los errores viajan en el mensaje de la excepción, salvo verify_delivery_pin, que devuelve el resultado (ver docs/contrato-api.md).

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  workshop_id uuid not null references public.workshops (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  tags text[] not null default '{}' check (cardinality(tags) <= 5),
  comment text check (comment is null or char_length(comment) between 1 and 1000),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index reviews_workshop_idx on public.reviews (workshop_id, created_at desc) where not hidden;
create index reviews_client_idx on public.reviews (client_id);

alter table public.reviews enable row level security;

-- Solo lectura: sin INSERT, UPDATE ni DELETE para ningún rol de la API (sin edición posterior).
revoke all on public.reviews from anon, authenticated;
grant select on public.reviews to authenticated;

-- Cliente y artesano activos ven las reseñas no ocultas; el cliente además ve las suyas aunque estén ocultas.
-- El admin no lee por tabla (usa funciones en CU-08); sin rol y anónimo no ven nada.
create policy reviews_select on public.reviews
  for select to authenticated
  using (
    private.is_active()
    and private.current_user_role() in ('client', 'craftsman')
    and (not hidden or client_id = (select auth.uid()))
  );

-- Recalcula promedio y conteo del taller desde cero sobre las reseñas no ocultas.
create function private.recalc_workshop_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workshop uuid := case when tg_op = 'DELETE' then old.workshop_id else new.workshop_id end;
begin
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

create trigger reviews_recalc_rating
  after insert or update of rating, hidden or delete on public.reviews
  for each row execute function private.recalc_workshop_rating();

-- El cliente genera el PIN de entrega (CU-06). Solo con el pedido `ready`. Devuelve el PIN una sola vez:
-- cada llamada rota el PIN y reinicia los intentos, pero no levanta un bloqueo vigente.
create function public.reveal_delivery_pin(p_order_id uuid)
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
  v_pin text;
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
  if v_role is distinct from 'client' then
    raise exception 'forbidden';
  end if;

  select o.* into v_order from public.orders o where o.id = p_order_id and o.client_id = v_uid for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_order.status <> 'ready' then
    raise exception 'invalid_state';
  end if;

  v_pin := lpad((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000)::text, 6, '0');
  insert into private.order_pins (order_id, pin_hash)
  values (v_order.id, extensions.crypt(v_pin, extensions.gen_salt('bf')))
  on conflict (order_id) do update
    set pin_hash = excluded.pin_hash, attempts = 0, revealed_at = now();

  return jsonb_build_object('order_id', v_order.id, 'pin', v_pin);
end;
$$;

-- El artesano dueño confirma la entrega con el PIN (o el QR, que trae el mismo PIN). Solo con el pedido `ready`.
-- 5 intentos y bloqueo de 15 minutos. Un PIN incorrecto NO lanza excepción (revertiría el contador): devuelve
-- { ok, attempts_left, locked_until, status }.
create function public.verify_delivery_pin(p_order_id uuid, p_pin text)
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
  v_pin private.order_pins;
  v_attempts integer;
  v_locked timestamptz;
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_order_id is null or p_pin is null or p_pin !~ '^[0-9]{6}$' then
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
  if v_order.status <> 'ready' then
    raise exception 'invalid_state';
  end if;

  -- Sin PIN generado (el cliente aún no lo muestra) no hay nada que adivinar.
  select * into v_pin from private.order_pins where order_id = v_order.id for update;
  if not found then
    raise exception 'invalid_state';
  end if;

  if v_pin.locked_until is not null and v_pin.locked_until > now() then
    return jsonb_build_object('ok', false, 'attempts_left', 0, 'locked_until', v_pin.locked_until, 'status', v_order.status);
  end if;

  if extensions.crypt(p_pin, v_pin.pin_hash) = v_pin.pin_hash then
    delete from private.order_pins where order_id = v_order.id;
    update public.orders set status = 'delivered', delivered_at = now() where id = v_order.id
    returning * into v_order;

    select w.owner_id into v_owner from public.workshops w where w.id = v_order.workshop_id;
    insert into public.messages (request_id, sender_id, body, kind)
    values (v_order.request_id, null, 'Pedido entregado y resuelto', 'system');
    -- A2: aviso de calificación pendiente (sin pg_cron; la pantalla también consulta listPendingReviews).
    insert into public.notifications (user_id, type, payload)
    values (v_order.client_id, 'order_delivered',
      jsonb_build_object('order_id', v_order.id, 'request_id', v_order.request_id, 'review_pending', true));
    return jsonb_build_object('ok', true, 'attempts_left', 5, 'locked_until', null, 'status', v_order.status);
  end if;

  v_attempts := v_pin.attempts + 1;
  if v_attempts >= 5 then
    v_locked := now() + interval '15 minutes';
    update private.order_pins set attempts = 0, locked_until = v_locked where order_id = v_order.id;
    return jsonb_build_object('ok', false, 'attempts_left', 0, 'locked_until', v_locked, 'status', v_order.status);
  end if;
  update private.order_pins set attempts = v_attempts, locked_until = null where order_id = v_order.id;
  return jsonb_build_object('ok', false, 'attempts_left', 5 - v_attempts, 'locked_until', null, 'status', v_order.status);
end;
$$;

-- El cliente califica al artesano (1 a 5 estrellas) con reseña opcional. Solo una por pedido y solo con el pedido
-- `delivered`. Sin edición. El trigger recalcula el promedio del taller.
create function public.create_review(
  p_order_id uuid,
  p_rating integer,
  p_comment text default null,
  p_tags text[] default '{}'
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
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_tags text[] := coalesce(p_tags, '{}');
  v_review public.reviews;
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_order_id is null or p_rating is null or p_rating not between 1 and 5
     or (v_comment is not null and char_length(v_comment) > 1000)
     or cardinality(v_tags) > 5
     or exists (select 1 from unnest(v_tags) t where t is null or char_length(btrim(t)) not between 1 and 30) then
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

  select o.* into v_order from public.orders o where o.id = p_order_id and o.client_id = v_uid for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_order.status <> 'delivered' then
    raise exception 'invalid_state';
  end if;
  if exists (select 1 from public.reviews r where r.order_id = v_order.id) then
    raise exception 'invalid_state';
  end if;

  insert into public.reviews (order_id, client_id, workshop_id, rating, tags, comment)
  values (v_order.id, v_uid, v_order.workshop_id, p_rating, (select coalesce(array_agg(btrim(t)), '{}') from unnest(v_tags) t), v_comment)
  returning * into v_review;

  select w.owner_id into v_owner from public.workshops w where w.id = v_order.workshop_id;
  insert into public.notifications (user_id, type, payload)
  values (v_owner, 'review_received', jsonb_build_object('order_id', v_order.id, 'review_id', v_review.id, 'rating', v_review.rating));

  return jsonb_build_object(
    'id', v_review.id,
    'order_id', v_review.order_id,
    'workshop_id', v_review.workshop_id,
    'rating', v_review.rating,
    'tags', to_jsonb(v_review.tags),
    'comment', v_review.comment,
    'hidden', v_review.hidden,
    'created_at', v_review.created_at
  );
end;
$$;

revoke execute on function public.reveal_delivery_pin(uuid) from public, anon;
grant execute on function public.reveal_delivery_pin(uuid) to authenticated;
revoke execute on function public.verify_delivery_pin(uuid, text) from public, anon;
grant execute on function public.verify_delivery_pin(uuid, text) to authenticated;
revoke execute on function public.create_review(uuid, integer, text, text[]) from public, anon;
grant execute on function public.create_review(uuid, integer, text, text[]) to authenticated;
