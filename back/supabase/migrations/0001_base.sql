-- 0001_base: esquema private, enums, extensiones y privilegios por defecto.
-- Ver docs/decisiones/0001-arquitectura.md (secciones 2 y 5).
-- No contiene tablas. Las tablas llegan en migraciones posteriores, una por CU.

-- Extensiones (pgcrypto se usará para el hash del PIN de entrega).
create extension if not exists pgcrypto with schema extensions;

-- Esquema private: helpers de RLS. No se expone por PostgREST.
create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- Funciones futuras de private: sin EXECUTE para public ni anon; sí para authenticated.
-- (Aplica a objetos creados por el rol que corre las migraciones.)
alter default privileges in schema private revoke execute on functions from public, anon;
alter default privileges in schema private grant execute on functions to authenticated;

-- Funciones de private que ya existan.
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- Privilegios por defecto en public: nada para anon; authenticated solo lo que se conceda
-- explícitamente (incluso por columna) en cada migración.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon;

-- Objetos que ya existan en public (por ejemplo, creados desde el panel).
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from public, anon;

-- Enums del dominio.
create type public.user_role as enum ('client', 'craftsman', 'admin');
create type public.service_type as enum ('repair', 'cleaning');
create type public.request_status as enum ('draft', 'open', 'quoted', 'accepted', 'declined', 'cancelled');
create type public.quote_status as enum ('sent', 'accepted', 'rejected', 'superseded');
create type public.order_status as enum ('in_progress', 'ready', 'delivered', 'cancelled');
create type public.message_kind as enum ('text', 'quote_card', 'system');
