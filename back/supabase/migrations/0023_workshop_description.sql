-- 0023_workshop_description: columna description del taller (CU-07).
-- Cierra el pendiente documentado en docs/contrato-api.md:119.

alter table public.workshops
  add column description text check (char_length(description) <= 500);

grant insert (description), update (description) on public.workshops to authenticated;
