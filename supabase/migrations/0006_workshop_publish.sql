-- 0006_workshop_publish: validar y publicar el taller en el mapa (CU-07, A1). Requiere 0004 y 0005.
-- Devuelven el resultado en lugar de lanzar cuando faltan datos: { published, missing[] }.

-- Campos obligatorios que faltan para publicar (nombres de campo del contrato).
create function private.workshop_missing_fields(p_workshop_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_remove(array[
    case when w.name is null then 'name' end,
    case when w.address is null then 'address' end,
    case when w.colonia is null then 'colonia' end,
    case when w.lat is null or w.lng is null then 'location' end,
    case when cardinality(w.services) = 0 then 'services' end,
    case when w.hours is null
           or not exists (select 1 from jsonb_each(w.hours) e where jsonb_array_length(e.value) > 0)
         then 'hours' end,
    case when w.price_from is null then 'price_from' end
  ], null)
  from public.workshops w
  where w.id = p_workshop_id
    and w.owner_id = (select auth.uid());
$$;

-- Publica el taller propio si está completo; si no, devuelve la lista de campos faltantes.
create function public.publish_my_workshop()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role public.user_role;
  v_active boolean;
  v_workshop public.workshops;
  v_missing text[];
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
  if v_workshop.suspended then
    raise exception 'forbidden';
  end if;

  v_missing := private.workshop_missing_fields(v_workshop.id);
  if cardinality(v_missing) > 0 then
    return jsonb_build_object('published', false, 'missing', to_jsonb(v_missing));
  end if;

  update public.workshops set published = true where id = v_workshop.id;
  return jsonb_build_object('published', true, 'missing', '[]'::jsonb);
end;
$$;

-- Retira el taller propio del mapa (no borra datos).
create function public.unpublish_my_workshop()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role public.user_role;
  v_active boolean;
  v_rows integer;
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

  update public.workshops set published = false where owner_id = v_uid;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'not_found';
  end if;
  return jsonb_build_object('published', false, 'missing', '[]'::jsonb);
end;
$$;

revoke execute on function public.publish_my_workshop() from public, anon;
grant execute on function public.publish_my_workshop() to authenticated;
revoke execute on function public.unpublish_my_workshop() from public, anon;
grant execute on function public.unpublish_my_workshop() to authenticated;
