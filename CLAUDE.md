# MiXanab

"No lo tires, restáuralo." PWA para talleres de talabartería y calzado en Mérida, Yucatán.
Conecta clientes con artesanos: mapa de talleres, cotización con fotos y chat, presupuesto,
seguimiento en 4 fases, entrega con PIN/QR y calificación.

- Cronograma: el del tablero de FigJam quedó desactualizado. La codificación empieza el 12 nov 2026 y
  el cronograma vigente está en Notion. Pega aquí los hitos nuevos (CU funcionales, regresión, piloto, despliegue y cierre).
- Especificación: `docs/requisitos.md` (CU-01 a CU-08). Diseño: `docs/diseno.md`.
  Arquitectura y decisiones aprobadas: `docs/decisiones/0001-arquitectura.md`.
  Léelos antes de implementar cualquier caso de uso.

## Equipo y responsabilidades

- **Angel Rosado:** todo el backend. Dueño de `supabase/` (migraciones, RLS, funciones SQL, Storage), `js/features/*/api.js` y `js/supabaseClient.js`.
- **Milton:** frontend (pantallas, `css/` y `js/features/*/pages` de su parte).
- **Abraham:** frontend (igual, de su parte).
- **José Cárdenas:** pruebas del backend. Dueño de `tests/rls/` y de la colección de Postman.

Reparto de pantallas propuesto: Milton = Acceso + Artesano + Admin; Abraham = Cliente.
El chat lo construye Abraham como componente reutilizable y Milton lo reutiliza.

Reglas de convivencia:
- El frontend trabaja contra el `api.js` simulado (modo `USAR_API_SIMULADA` de `js/config.js`), siguiendo `docs/contrato-api.md`. Cuando el backend de un CU se fusiona, se cambia a la versión real.
- Nadie del frontend edita `supabase/`; nadie del backend edita `css/` ni pantallas, salvo acuerdo.
- Todo cambio al contrato (nombres, parámetros, errores) se actualiza en `docs/contrato-api.md` en el mismo commit.
- Solo Angel aplica migraciones al proyecto de desarrollo de Supabase. José prueba en un proyecto de pruebas aparte.
- Cada persona hace commit con su propio usuario de GitHub.
- Orden de entrega del backend: base + CU-01 → CU-07 → CU-03 → CU-04 → CU-05 → CU-06 → CU-02 → CU-08.
- Comandos del equipo: `/implementar-backend` (Angel), `/implementar-pantalla` (Milton y Abraham), `/probar-backend` (José). `/implementar-cu` es para una sola persona de punta a punta.

## Comandos

- Instalar: `npm install` (el `postinstall` copia Leaflet y supabase-js a `js/vendor/`).
- Servidor local: `npm run dev` (http://localhost:5500).
- Pruebas unitarias: `npm test`. Pruebas de permisos RLS: `npm run test:rls` (requiere Docker y Supabase local).
- Lint: `npm run lint` (`npm run lint:fix` para corregir).
- Base de datos local (solo quien escribe migraciones, requiere Docker): `npm run db:init`, `db:start`, `db:reset`, `db:stop`.
- No hay script de `db push`: nunca se aplica a un proyecto remoto sin confirmación.

## Stack

- Front: HTML5, CSS3 (responsive, mobile-first) y JavaScript ES6+ sin framework ni bundler. PWA (manifest + service worker).
- Backend: Supabase (Auth con Google y correo, PostgreSQL, Storage, Realtime). Sin servidor propio.
- Base de datos: PostgreSQL relacional (3FN); columnas JSONB para metadatos de cotizaciones y horarios.
- Mapa: Leaflet + OpenStreetMap (solo con sesión iniciada).
- Pruebas: Jest (unitarias con jsdom y de permisos RLS), Postman (endpoints), Chrome DevTools (rendimiento y diseño adaptable).
- Herramientas: VS Code (ESLint), GitHub, Figma (organización), Notion (itinerario), Canva (wireframes).
- Sin CI, sin typecheck y sin `pg_cron` por ahora (decisión D3).

## Estructura

```
/index.html  /manifest.webmanifest  /sw.js  /icons/
/css/        # tokens.css (colores y tipografía), components.css, una hoja por pantalla
/js/
  app.js  router.js  supabaseClient.js  config.js
  features/<modulo>/   # auth, map, requests, chat, quotes, orders, workshop, admin
                       # routes.js (rutas), api.js (único que toca Supabase), api.mock.js, view.js
  lib/                 # escape de texto, validaciones, formato MXN
  vendor/              # generado por `npm run vendor`; no se versiona
/supabase/migrations/  # SQL versionado (una migración por CU)
/tests/unit/  /tests/rls/  /tests/helpers/
/scripts/    # utilidades de npm (vendor)
/docs/       # requisitos.md, diseno.md, decisiones/
```

## Roles

- `client` (cliente), `craftsman` (artesano/talabartero) y `admin` (administración).
- El rol vive en `profiles.role`, empieza en nulo y se elige una sola vez con `set_my_role` (función `security definer`). **El usuario no puede editarlo** (sin `UPDATE(role)` para `authenticated`). Nunca se lee de `user_metadata`.
- `admin` es una cuenta interna del equipo creador (no se elige en el registro ni se asigna desde la app): se crea a mano con la clave de servicio.
  Administra usuarios, talleres, reseñas y calificaciones (CU-08, ver `docs/requisitos.md`). En esta versión el admin **no lee** el contenido de los chats ni las fotos privadas.
  Toda acción del admin pasa por funciones SQL `security definer` y queda en una bitácora (`admin_actions`).

## Reglas de seguridad (no negociables)

- No hay servidor propio: **toda la seguridad está en RLS y funciones SQL**. Cada tabla y cada bucket de Storage con RLS activo; sin política = denegado.
- La `anon key` puede ir en el frontend. La `service_role` **nunca** va en el frontend ni en el repo.
- Lógica sensible en funciones `security definer` (con `search_path = ''`) o Edge Functions, no en el navegador:
  verificación del PIN de entrega, transiciones de fase y promedio de calificaciones.
- Esquema `private` (helpers de RLS): `authenticated` necesita `USAGE` en el esquema y `EXECUTE` en cada función; `anon` y `public` no reciben nada. Se verifica con `tests/rls/grants.test.js` (ver sección 5 de `0001-arquitectura.md`).
- Funciones expuestas en `public`: `execute` revocado a `public` y `anon`, concedido a `authenticated`.
- PIN de entrega: 6 dígitos, se guarda con hash, se verifica con una función con límite de intentos (5, luego bloqueo de 15 minutos); el cliente solo lo ve cuando el pedido está listo. Un PIN incorrecto no lanza excepción, devuelve el resultado.
- Fases del pedido: solo avanzan de una en una (o se corrigen con confirmación, A1 de CU-05). Cada cambio exige foto de avance.
- Reseñas: una por pedido, solo del cliente de ese pedido y solo si está entregado. Sin edición.
- Solicitudes: se cancelan solo en `open` o `quoted`; máximo 5 activas por cliente.
- Chat: solo los dos participantes de la solicitud (también en Realtime). Texto siempre escapado, nunca como HTML (`textContent`, nunca `innerHTML`; ESLint lo prohíbe).
- Fotos: solo imágenes jpeg, png o webp, máximo 5 MB. Fotos de solicitudes y avances privadas a los participantes; fotos del taller públicas.
- Datos personales del cliente (edad, dirección) en `client_private`: el artesano no los ve.
- Service worker: solo cachea la interfaz. Nunca cachea Supabase, tiles ni fotos, y ignora todo lo que no sea GET same-origin.
- Contraseñas y llaves solo en variables de entorno o configuración de Supabase; nunca en el repo.

## Diseño

Mobile-first, interfaz en español, estilo "artesanal moderno". Paleta y tipografías en `docs/diseno.md`.
La PWA debe cargar en menos de 2 s con 3G/4G.

## Flujo de trabajo por caso de uso (CU)

1. Leer el CU en `docs/requisitos.md` y las pantallas en `docs/diseno.md`.
2. Plan breve (modo plan) antes de escribir código.
3. Migración SQL con RLS (solo quien tiene Docker), lógica, pantallas y pruebas Jest (incluye pruebas de permisos por rol).
   Quien no tiene Docker trabaja con `api.mock.js` y `USAR_API_SIMULADA = true` en `js/config.js`.
4. Correr lint y pruebas, y marcar el checklist del CU.
5. Una rama por CU (`feat/cu-03-cotizacion`) con varios commits pequeños (ver "Commits").

Orden sugerido: CU-01 → CU-07 → CU-02 → CU-03 → CU-04 → CU-05 → CU-06 → CU-08 → regresión.

## Commits

- Varios commits pequeños por CU: uno por cambio lógico (migración, función SQL, pantalla, pruebas, docs).
- Formato `tipo(alcance): descripción`, en español, en imperativo y de menos de 72 caracteres.
  Ejemplo: `feat(auth): agrega función set_my_role`.
- Commitea solo cuando lint y pruebas pasan.
- Agrega los archivos por nombre; nunca `git add -A`.
- Sin commits de relleno y sin mezclar cambios no relacionados en un mismo commit.

## Reglas para Claude Code

- No ejecutes `db push` ni apliques migraciones sin mi confirmación explícita.
- No uses `git add -A`: agrega los archivos por nombre.
- No lances subagentes salvo que los pida o sean imprescindibles.
- No agregues dependencias sin justificarlas.
- No edites migraciones ya aplicadas: crea una nueva.
- No cambies la matriz de permisos sin avisarme.

## Dudas por validar con el equipo

1. Alcance del admin (CU-08) propuesto por el equipo: confirmar que el admin no vea chats ni fotos privadas.
2. "Python Flet" (apartado Prototipado) y "WhatsApp API" (cronograma) no aparecen en el resto del stack.
3. Pago: los mockups dicen "pagas al recoger", así que no hay pasarela de pago.
4. Tipografías Poppins e Inter: ¿archivos locales o solo fuentes del sistema?
Resueltas (ver `docs/decisiones/0001-arquitectura.md`): formato del jsonb `workshops.hours` (claves `mon`..`sun`, hasta 2 rangos `HH:MM`, hora de Mérida); OTP y PIN de 6 dígitos; varios talleres a la vez permitido (máximo 5 activas); cancelación en `open` o `quoted`.
