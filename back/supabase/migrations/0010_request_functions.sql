-- 0010_request_functions: enviar y cancelar solicitudes (CU-03). Requiere 0007, 0008 y 0009.
-- Los errores viajan en el mensaje de la excepción (docs/contrato-api.md).
-- CU-04 reemplazará cancel_request para marcar también el presupuesto vigente (`quotes`).

-- Envía la solicitud: `draft` -> `open`. Exige foto, taller disponible y máximo 5 activas (open o quoted).
create function public.submit_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role public.user_role;
  v_active boolean;
  v_request public.service_requests;
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_request_id is null then
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

  -- Bloquea la fila para que dos envíos simultáneos no rebasen el límite.
  select * into v_request from public.service_requests r
   where r.id = p_request_id and r.client_id = v_uid
   for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_request.status <> 'draft' then
    raise exception 'invalid_state';
  end if;
  if not exists (select 1 from public.request_photos f where f.request_id = v_request.id) then
    raise exception 'photo_required';
  end if;
  if not private.workshop_accepts_requests(v_request.workshop_id, v_request.service_type) then
    raise exception 'invalid_state';
  end if;
  -- Serializa los envíos del mismo cliente antes de contar sus activas.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  if (select count(*) from public.service_requests r
       where r.client_id = v_uid and r.status in ('open', 'quoted')) >= 5 then
    raise exception 'limit_reached';
  end if;

  update public.service_requests
     set status = 'open', submitted_at = now()
   where id = v_request.id;

  select w.owner_id into v_owner from public.workshops w where w.id = v_request.workshop_id;
  insert into public.messages (request_id, sender_id, body, kind)
  values (v_request.id, null, 'Solicitud enviada', 'system');
  insert into public.notifications (user_id, type, payload)
  values (v_owner, 'request_received', jsonb_build_object('request_id', v_request.id));

  return jsonb_build_object('id', v_request.id, 'status', 'open');
end;
$$;

-- Cancela la solicitud (A2): solo desde `open` o `quoted`. Avisa al artesano.
create function public.cancel_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role public.user_role;
  v_active boolean;
  v_request public.service_requests;
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_request_id is null then
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

  select * into v_request from public.service_requests r
   where r.id = p_request_id and r.client_id = v_uid
   for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_request.status not in ('open', 'quoted') then
    raise exception 'invalid_state';
  end if;

  update public.service_requests set status = 'cancelled' where id = v_request.id;

  select w.owner_id into v_owner from public.workshops w where w.id = v_request.workshop_id;
  insert into public.messages (request_id, sender_id, body, kind)
  values (v_request.id, null, 'Solicitud cancelada por el cliente', 'system');
  insert into public.notifications (user_id, type, payload)
  values (v_owner, 'request_cancelled', jsonb_build_object('request_id', v_request.id));

  return jsonb_build_object('id', v_request.id, 'status', 'cancelled');
end;
$$;

revoke execute on function public.submit_request(uuid) from public, anon;
grant execute on function public.submit_request(uuid) to authenticated;
revoke execute on function public.cancel_request(uuid) from public, anon;
grant execute on function public.cancel_request(uuid) to authenticated;
