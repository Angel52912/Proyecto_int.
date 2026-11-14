# Requisitos de MiXanab

Fuente: tablero de FigJam del proyecto (casos de uso, UML, wireframes y mockups).
Decisiones de arquitectura vigentes: `docs/decisiones/0001-arquitectura.md`.
Los RF01–RF08, RNF01–RNF05 y HU01–HU04 que menciona el cronograma están en el documento de requisitos del equipo:
pégalos en la sección 4 para que Claude Code los tenga.

## 1. Actores

- **Cliente**: persona que busca un taller, pide cotización, sigue su pedido y califica.
- **Artesano / talabartero**: dueño de un taller que cotiza, trabaja el pedido por fases y entrega.
- **Administración**: cuenta interna del equipo creador para administrar talleres, clientes, reseñas, calificaciones y usuarios (CU-08, propuesto).

## 2. Casos de uso

Leyenda: (A#) = flujo alternativo. Pantallas: ver `docs/diseno.md`.

### CU-01. Registro e inicio de sesión (Cliente, Artesano)
- [x] Registrarse o ingresar con Google o correo.
- [x] Enviar código de verificación de 6 dígitos al correo (sistema).
- [x] Ingresar el código de verificación.
- [x] Seleccionar rol: Cliente o Artesano (una sola vez; no se puede cambiar desde la app).
- [x] Completar perfil (nombre, foto, edad, dirección para el cliente).
- [ ] A1: mostrar error de credenciales.
- [x] A2: reenviar código de verificación.

Nota: se eliminó A3 ("correo ya registrado"). Para no revelar qué correos existen, el registro muestra un mensaje genérico.

### CU-02. Búsqueda de artesanos en mapa (Cliente)
- [ ] Seleccionar categoría de servicio (Reparación o Limpieza).
- [ ] Visualizar el mapa de talleres cercanos (solo con sesión iniciada).
- [x] Filtrar por distancia, colonia, calificación, horario (Abierto) o precio "desde".
- [x] Consultar el perfil del artesano (calificación, servicios, horario, precio "desde", trabajos recientes).
- [x] A1: ingresar colonia o C.P. manualmente (si no hay ubicación).
- [ ] A2: mostrar aviso sin resultados.

### CU-03. Solicitud de cotización por foto y chat (Cliente, Artesano)
- [x] Adjuntar fotografías del calzado (al menos una).
- [x] Describir el problema.
- [x] Enviar solicitud (máximo 5 solicitudes activas por cliente; activa = abierta o cotizada).
- [x] Notificar al artesano (sistema) y que este reciba la notificación.
- [x] Abrir chat privado (sistema) y responder en él.
- [x] A1: solicitar archivos válidos (solo imágenes jpeg, png o webp, máximo 5 MB).
- [x] A2: cancelar solicitud (solo si está abierta o cotizada).

### CU-04. Confirmación y aceptación de presupuesto (Artesano, Cliente)
- [x] El artesano captura costo (MXN) y fecha de entrega.
- [x] Enviar presupuesto final; enviar la tarjeta de presupuesto al chat (sistema).
- [x] El cliente revisa la propuesta y acepta.
- [x] Registrar la orden de trabajo y notificar a ambas partes (sistema).
- [x] A1: el cliente rechaza el presupuesto.
- [x] A2: el artesano rectifica el presupuesto.

### CU-05. Actualización y seguimiento de fases del servicio (Artesano, Cliente)
- [x] Seleccionar pedido activo.
- [x] Actualizar la fase (4 fases: Inspección, Desinfección/pretratamiento, Limpieza/reparación, Secado/detallado).
- [x] Adjuntar fotografía de avance (obligatoria en cada cambio de fase).
- [x] Actualizar la barra de progreso (sistema).
- [x] El cliente consulta el estatus en tiempo real.
- [x] Notificar "Listo para entrega" y que el cliente reciba el aviso.
- [x] A1: confirmar o corregir un salto de fase.

### CU-06. Confirmación de entrega y calificación (Cliente, Artesano)
- [x] El cliente muestra el código PIN de 6 dígitos o QR (solo con el pedido listo).
- [x] El artesano ingresa el PIN o escanea el QR (5 intentos; luego bloqueo de 15 minutos).
- [x] Marcar el pedido "Entregado y resuelto" (sistema).
- [x] El cliente califica al artesano (1 a 5 estrellas) y escribe una reseña opcional (sin edición posterior).
- [x] Actualizar el promedio del artesano (sistema).
- [x] A1: rechazar código inválido.
- [x] A2: recordar la calificación pendiente.

### CU-07. Configuración de perfil de taller (Artesano)
- [x] Capturar el nombre del taller.
- [x] Subir foto de perfil y de trabajos.
- [x] Registrar dirección y ubicación en el mapa.
- [x] Registrar horario y precio "desde".
- [x] Guardar el perfil.
- [x] Validar y publicar el taller en el mapa (sistema).
- [x] A1: resaltar los campos obligatorios faltantes.

### CU-08. Administración de la plataforma (Admin) — propuesto
- [ ] Iniciar sesión como administrador (cuenta creada por el equipo; no se puede elegir en el registro).
- [x] Panel con totales: usuarios, talleres, solicitudes, pedidos y calificación promedio.
- [x] Usuarios: listar, buscar, desactivar y reactivar (no se eliminan).
- [x] Talleres: listar, suspender o despublicar del mapa y reactivar.
- [x] Reseñas y calificaciones: ocultar y restaurar (el promedio del taller se recalcula).
- [x] Solicitudes y pedidos: consulta de solo lectura (estatus y fechas), sin ver el contenido del chat ni las fotos privadas.
- [x] Bitácora: toda acción del admin queda registrada (quién, qué y cuándo).
- [x] A1: el admin no puede desactivarse a sí mismo y siempre debe quedar al menos un admin activo.

## 3. Modelo de datos (3FN)

Detalle de columnas, restricciones y RLS en `docs/decisiones/0001-arquitectura.md`.
El rol de `profiles` es nulo hasta que el usuario lo elige con `set_my_role`.

| Tabla | Campos clave |
|---|---|
| `profiles` | id (= auth.users), role, full_name, avatar_path, active |
| `client_private` | user_id, age, address (visible solo para el propio cliente) |
| `workshops` | id, owner_id, name, address, colonia, postal_code, lat, lng, services, hours (jsonb), price_from, published, suspended, rating_avg, rating_count |
| `workshop_photos` | id, workshop_id, path, sort |
| `service_requests` | id, client_id, workshop_id, service_type, description, status (draft, open, quoted, accepted, declined, cancelled) |
| `request_photos` | id, request_id, path |
| `messages` | id, request_id, sender_id, body, kind (texto, tarjeta de presupuesto o sistema), quote_id, created_at |
| `quotes` | id, request_id, amount_mxn, delivery_date, detail (jsonb), status |
| `orders` | id, quote_id, request_id, client_id, workshop_id, phase (1 a 4), status, due_date, ready_at, delivered_at (el PIN vive aparte en `private.order_pins`) |
| `order_updates` | id, order_id, phase, photo_path (obligatoria), note, corrected, created_by, created_at |
| `reviews` | id, order_id (único), client_id, workshop_id, rating (1 a 5), tags, comment, hidden |
| `notifications` | id, user_id, type, payload (jsonb), read_at, created_at |
| `admin_actions` | id, admin_id, action, target_table, target_id, details (jsonb), created_at |

## 4. Requisitos no funcionales

- [ ] Mobile-first y PWA instalable.
- [ ] La PWA carga en menos de 2 s con 3G/4G.
- [ ] Interfaz en español.
- [ ] El service worker solo guarda en caché la interfaz; nunca respuestas de Supabase, tiles ni fotos.
- [ ] (Pegar aquí RF01–RF08, RNF01–RNF05 y HU01–HU04 del documento del equipo.)

## 5. Pruebas (cronograma)

- [ ] Carga de 5 a 10 talleres de prueba de Mérida.
- [ ] Prueba de extremo a extremo: solicitud, chat, presupuesto, seguimiento, entrega y calificación.
- [ ] Validación móvil y rendimiento.
- [ ] Regresión de los 8 casos de uso con resultados registrados.

## 6. Medición de Claude Code (para el reporte)

| CU | Tiempo | Consumo (`/usage`) | Correcciones necesarias | Notas |
|---|---|---|---|---|
| CU-01 | | | | |
| CU-07 | | | | |
