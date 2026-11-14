-- 0013_order_pins: mueve el PIN de entrega de public.orders a private.order_pins (CU-06). Requiere 0011.
-- Motivo: Realtime (postgres_changes) envía la fila completa a quien pase el RLS y no respeta los permisos por
-- columna, así que el hash del PIN de `orders` (publicada en Realtime) se filtraría. `private` no lo expone PostgREST
-- ni va en la publicación. Solo las funciones `security definer` de CU-06 tocan esta tabla.
-- Las tres columnas de `orders` nunca se escribieron ni se leyeron (el PIN llega en CU-06): borrarlas no pierde datos.

create table private.order_pins (
  order_id uuid primary key references public.orders (id) on delete cascade,
  pin_hash text not null,
  attempts smallint not null default 0 check (attempts between 0 and 5),
  locked_until timestamptz,
  revealed_at timestamptz not null default now()
);

-- RLS activo y sin políticas ni grants: ningún rol de la API lee ni escribe esta tabla.
alter table private.order_pins enable row level security;
revoke all on private.order_pins from public, anon, authenticated;

alter table public.orders
  drop column delivery_pin_hash,
  drop column pin_attempts,
  drop column pin_locked_until;
