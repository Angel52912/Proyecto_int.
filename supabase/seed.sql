-- seed.sql: datos de ejemplo para DESARROLLO y PRUEBAS. Nunca se ejecuta en producción.
-- Qué crea: 8 talleres publicados de Mérida (con su artesano) y 3 clientes de ejemplo.
-- Cómo se usa:
--   * Local: `npm run db:reset` lo aplica solo al terminar las migraciones (supabase/seed.sql es la ruta por defecto).
--   * Proyecto de desarrollo o de pruebas: pegarlo en el editor SQL del panel de Supabase (corre como `postgres`).
-- Es idempotente: se puede ejecutar varias veces; no duplica nada.
-- Las cuentas de ejemplo usan correos @seed.mixanab.test que no existen ni tienen contraseña: nadie puede iniciar sesión
-- con ellas. Para probar como artesano o cliente, inicia sesión con tu propio correo y elige el rol; el admin se crea
-- aparte (docs/operacion/cuenta-admin.md).
-- Las calificaciones de los talleres se escriben directo (son un caché que el trigger de `reviews` recalcula cuando
-- haya reseñas reales).

do $$
declare
  v_taller record;
  v_cliente record;
begin
  -- Artesanos y sus talleres ---------------------------------------------------------------------------------------
  for v_taller in
    select * from (values
      ('a0000000-0000-4000-8000-000000000001'::uuid, 'Calzado El Buen Paso',   'Don Armando Pech',   'Calle 60 #500 por 63 y 65',          'Centro',               '97000', 20.9674, -89.5926, '{repair,cleaning}', '{"mon":[{"open":"09:00","close":"18:00"}],"tue":[{"open":"09:00","close":"18:00"}],"wed":[{"open":"09:00","close":"18:00"}],"thu":[{"open":"09:00","close":"18:00"}],"fri":[{"open":"09:00","close":"18:00"}],"sat":[{"open":"09:00","close":"14:00"}]}', 120.00, 4.8, 25),
      ('a0000000-0000-4000-8000-000000000002'::uuid, 'Talabartería Yucatán',   'Doña Rosa Canul',    'Calle 21 #100 por 18 y 20',          'García Ginerés',       '97070', 20.9812, -89.6329, '{repair}',          '{"mon":[{"open":"08:00","close":"14:00"},{"open":"16:00","close":"19:00"}],"tue":[{"open":"08:00","close":"14:00"},{"open":"16:00","close":"19:00"}],"wed":[{"open":"08:00","close":"14:00"},{"open":"16:00","close":"19:00"}],"thu":[{"open":"08:00","close":"14:00"},{"open":"16:00","close":"19:00"}],"fri":[{"open":"08:00","close":"14:00"}]}', 80.00, 4.2, 10),
      ('a0000000-0000-4000-8000-000000000003'::uuid, 'Limpieza de Tenis Itzimná', 'Luis Dzul',        'Calle 32 #200 por 15 y 17',          'Itzimná',              '97100', 21.0014, -89.6001, '{cleaning}',        '{"mon":[{"open":"10:00","close":"19:00"}],"tue":[{"open":"10:00","close":"19:00"}],"wed":[{"open":"10:00","close":"19:00"}],"thu":[{"open":"10:00","close":"19:00"}],"fri":[{"open":"10:00","close":"19:00"}],"sat":[{"open":"10:00","close":"15:00"}],"sun":[{"open":"10:00","close":"14:00"}]}', 150.00, null, 0),
      ('a0000000-0000-4000-8000-000000000004'::uuid, 'Zapatería Montejo',      'Martín Chan',        'Av. Montejo #10 por 27',             'Francisco de Montejo', '97203', 21.0345, -89.6502, '{repair,cleaning}', '{"mon":[{"open":"09:00","close":"20:00"}],"tue":[{"open":"09:00","close":"20:00"}],"wed":[{"open":"09:00","close":"20:00"}],"thu":[{"open":"09:00","close":"20:00"}],"fri":[{"open":"09:00","close":"20:00"}],"sat":[{"open":"09:00","close":"20:00"}]}', 200.00, 3.9, 4),
      ('a0000000-0000-4000-8000-000000000005'::uuid, 'Cuero y Suela Santa Ana', 'Beatriz Uc',        'Calle 47 #455 por 56 y 58',          'Santa Ana',            '97000', 20.9601, -89.6188, '{repair}',          '{"tue":[{"open":"09:00","close":"17:00"}],"wed":[{"open":"09:00","close":"17:00"}],"thu":[{"open":"09:00","close":"17:00"}],"fri":[{"open":"09:00","close":"17:00"}],"sat":[{"open":"09:00","close":"13:00"}]}', 95.00, 4.6, 14),
      ('a0000000-0000-4000-8000-000000000006'::uuid, 'Restauración de Bolsos Altabrisa', 'Karla May',  'Calle 20 #300 por 11 y 13',          'Altabrisa',            '97130', 21.0191, -89.5827, '{repair,cleaning}', '{"mon":[{"open":"10:00","close":"18:00"}],"tue":[{"open":"10:00","close":"18:00"}],"wed":[{"open":"10:00","close":"18:00"}],"thu":[{"open":"10:00","close":"18:00"}],"fri":[{"open":"10:00","close":"18:00"}]}', 250.00, 5.0, 3),
      ('a0000000-0000-4000-8000-000000000007'::uuid, 'Taller Montes de Amé',   'Jorge Tun',          'Calle 14 #120 por 5 y 7',            'Montes de Amé',        '97115', 21.0083, -89.6252, '{repair}',          '{"mon":[{"open":"08:30","close":"17:30"}],"tue":[{"open":"08:30","close":"17:30"}],"wed":[{"open":"08:30","close":"17:30"}],"thu":[{"open":"08:30","close":"17:30"}],"fri":[{"open":"08:30","close":"17:30"}],"sat":[{"open":"08:30","close":"12:30"}]}', 110.00, 4.0, 6),
      ('a0000000-0000-4000-8000-000000000008'::uuid, 'Lavado de Calzado Chuburná', 'Pedro Cen',       'Calle 29 #98 por 12 y 14',           'Chuburná de Hidalgo',  '97205', 21.0412, -89.6633, '{cleaning}',        '{"mon":[{"open":"09:00","close":"18:00"}],"tue":[{"open":"09:00","close":"18:00"}],"wed":[{"open":"09:00","close":"18:00"}],"thu":[{"open":"09:00","close":"18:00"}],"fri":[{"open":"09:00","close":"18:00"}],"sat":[{"open":"09:00","close":"14:00"}]}', 130.00, 4.4, 8)
    ) as t(id, nombre, dueno, direccion, colonia, cp, lat, lng, servicios, horario, precio, calificacion, resenas)
  loop
    insert into auth.users (id, email, raw_user_meta_data)
    values (v_taller.id, 'taller' || right(v_taller.id::text, 1) || '@seed.mixanab.test', '{}'::jsonb)
    on conflict (id) do nothing;

    -- El trigger on_auth_user_created ya creó el perfil sin rol: aquí se le da el rol y el nombre.
    update public.profiles
       set role = 'craftsman', full_name = v_taller.dueno
     where id = v_taller.id and role is null;

    insert into public.workshops (owner_id, name, address, colonia, postal_code, lat, lng, services, hours, price_from,
                                  published, rating_avg, rating_count)
    values (v_taller.id, v_taller.nombre, v_taller.direccion, v_taller.colonia, v_taller.cp, v_taller.lat, v_taller.lng,
            v_taller.servicios::public.service_type[], v_taller.horario::jsonb, v_taller.precio,
            true, v_taller.calificacion, v_taller.resenas)
    on conflict (owner_id) do nothing;
  end loop;

  -- Clientes de ejemplo ---------------------------------------------------------------------------------------------
  for v_cliente in
    select * from (values
      ('c0000000-0000-4000-8000-000000000001'::uuid, 'Ana López',   28, 'Calle 55 #310 por 40 y 42, Centro, Mérida'),
      ('c0000000-0000-4000-8000-000000000002'::uuid, 'Bruno Pérez', 35, 'Calle 12 #85 por 3 y 5, Itzimná, Mérida'),
      ('c0000000-0000-4000-8000-000000000003'::uuid, 'Carla Ek',    41, 'Av. Itzáes #600 por 84 y 86, García Ginerés, Mérida')
    ) as t(id, nombre, edad, direccion)
  loop
    insert into auth.users (id, email, raw_user_meta_data)
    values (v_cliente.id, 'cliente' || right(v_cliente.id::text, 1) || '@seed.mixanab.test', '{}'::jsonb)
    on conflict (id) do nothing;

    update public.profiles
       set role = 'client', full_name = v_cliente.nombre
     where id = v_cliente.id and role is null;

    insert into public.client_private (user_id, age, address)
    values (v_cliente.id, v_cliente.edad, v_cliente.direccion)
    on conflict (user_id) do nothing;
  end loop;
end;
$$;
