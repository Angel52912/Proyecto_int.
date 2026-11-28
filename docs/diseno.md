# Diseño de MiXanab

Estilo: **"Mérida moderna"**, limpio, minimalista y de alto contraste, con un solo color de acento.
Es el rediseño del front (rama `nuevo-front`, noviembre de 2026) tras la revisión "poco intuitivo".
Fuentes anteriores: sección "Bakubs" (mockups) y "Wireframes" del tablero; prototipo "MiXanab · Mockups" en Figma.

Principio general: **cada pantalla tiene una sola acción principal** (el único botón naranja) y lo primero que se ve
es lo que la persona necesita ahora (su pedido en curso, su trabajo de hoy).

## Paleta C, "Mérida moderna"

Contraste medido con WCAG 2.1; todo el texto cumple al menos 4.5:1.

### Base

| Rol | Hex | Uso | Contraste |
|---|---|---|---|
| Fondo | `#F7F7F8` | Fondo de las pantallas | — |
| Superficie | `#FFFFFF` | Tarjetas, barras, chat, formularios | — |
| Borde | `#E4E4E7` | Bordes de tarjetas y separadores | — |
| Borde fuerte | `#D4D4D8` | Botón secundario, campos, zonas para soltar fotos | — |
| Texto | `#18181B` | Títulos y texto | 16.5:1 sobre fondo |
| Texto secundario | `#52525B` | Detalles, fechas, descripciones | 7.2:1 sobre fondo |
| Texto tenue | `#71717A` | Marcadores de posición, pestañas inactivas, pendientes | 4.5:1 sobre fondo, 4.8:1 sobre blanco |

### Acento y apoyo

| Rol | Hex | Uso | Contraste |
|---|---|---|---|
| **Acento** | **`#C2410C`** | Acción principal, pestaña activa, enlaces | 5.2:1 con texto blanco |
| Acento presionado | `#9A3412` | Hover, presionado, texto sobre acento suave | 7.3:1 con texto blanco |
| Acento suave | `#FFF1EA` | Contador "Nuevas", selección, avatar | `#9A3412` encima: 6.6:1 |
| Apoyo | `#1F3A5F` | Avance del pedido (fases, barra), información, mensajes propios del chat, botón Enviar | 11.5:1 con texto blanco |
| Apoyo suave | `#E8EEF6` | Avisos informativos, fase actual | `#1F3A5F` encima: 9.8:1 |

### Estados

Cada estado tiene un color fuerte (texto e ícono) y uno suave (fondo de la etiqueta o del aviso).

| Estado | Fuerte | Suave | Ejemplo |
|---|---|---|---|
| Éxito | `#15803D` | `#E8F5EC` | "Entregado", fase completada (4.5:1) |
| Aviso | `#A16207` | `#FEF6DC` | "Por confirmar" (4.6:1) |
| Error | `#B91C1C` | `#FDECEC` | "Cancelado", errores de formulario, contadores de no leídos (5.7:1) |
| Info | `#1F3A5F` | `#E8EEF6` | Consejos y fase actual (= apoyo) |

### Reglas de uso del color

- El **naranja** es solo para la acción principal de cada pantalla, la pestaña activa y los enlaces. Los demás botones
  son secundarios (blanco con borde `#D4D4D8`) o de texto.
- El **azul marino** marca el avance (fases, barra de progreso) y la información, para no competir con el naranja.
- El error y el acento son cálidos y se parecen: **un error siempre lleva ícono y texto**, nunca solo el color.
- Las etiquetas de estado son píldoras: fondo suave con texto del color fuerte.

### Modo oscuro

**Pospuesto.** El nuevo front se entrega primero solo en claro; el modo oscuro se diseña después sobre esta paleta.

## Tipografía y forma

| Uso | Fuente |
|---|---|
| Título de pantalla | Inter 20–22, negrita (500–600) |
| Subtítulo de sección | Inter 15–16, negrita |
| Texto y campos | Inter 15 |
| Secundario | Inter 12–13 |

- Esquinas: 12 px en tarjetas, botones y campos; píldoras (999 px) en etiquetas, filtros y contadores.
- Tarjetas: superficie blanca con borde de 1 px `#E4E4E7`, sin sombra.
- Íconos: de línea (trazo), 20 px en la barra y 18–20 px en botones.
- Tamaño táctil mínimo: 44 × 44 px.

## Navegación

Barra inferior **blanca** con borde arriba; la pestaña activa va en naranja (ícono y texto). Los contadores de
avisos sin leer son píldoras rojas sobre el ícono de la pestaña que corresponde.
El **Perfil** (cliente) y **Mi taller** (artesano) no son pestaña: se abren desde el avatar, arriba a la derecha.

| Rol | Pestañas |
|---|---|
| Cliente | Inicio · Buscar · Pedidos · Chats |
| Artesano | Tablero · Solicitudes · Chats · Historial |

Cuándo **se oculta** la barra:
- En las tareas por pasos (Pedir cotización, Enviar presupuesto, Avanzar fase, Calificar): solo Atrás y Continuar.
- En el chat: pantalla completa para que el teclado no tape la conversación.

En las pantallas de detalle (Seguimiento, Ficha del taller, Presupuesto) la barra se queda visible, con la pestaña
de origen activa.

## Flujo del cliente

Camino principal, con la acción principal de cada pantalla:

| # | Pantalla | Qué muestra | Acción principal |
|---|---|---|---|
| 1 | Inicio (CU-02) | Saludo, **pedido en curso arriba** (fase y barra), accesos Reparación y Limpieza, talleres cerca | Buscar taller |
| 2 | Buscar taller (CU-02) | **Mapa casi a pantalla completa**, buscador y filtros flotando arriba (Todos, Reparación, Abierto ahora), panel deslizable abajo con la lista | Ver taller |
| 3 | Ficha del taller (CU-02) | Fotos, horario, servicios, calificación y reseñas | Pedir cotización |
| 4 | Pedir cotización (CU-03) | **3 pasos** con barra de progreso: servicio, fotos (hasta 5), nota | Continuar / Enviar |
| 5 | Chat (CU-03) | Conversación; **el presupuesto llega como tarjeta dentro del chat** | Escribir |
| 6 | Presupuesto (CU-04) | Precio grande, fecha de entrega, detalle, "pagas al recoger" | Aceptar |
| 7 | Seguimiento (CU-05) | Aviso con la fase actual, línea de tiempo de las 4 fases con fotos, total a pagar | Escribir al taller |
| 8 | Recoger (CU-06) | PIN y código QR grandes, cómo llegar | Mostrar código |
| 9 | Calificar (CU-06) | Estrellas, etiquetas y comentario opcional | Enviar reseña |

Casos alternos:
- **Rechazar presupuesto:** vuelve al chat para negociar o buscar otro taller.
- **Cancelar solicitud:** desde el chat, mientras no haya pedido aceptado (estados `open` o `quoted`).
- Inicio sin pedido en curso: el botón "Buscar taller" queda como primer elemento.

Otras pantallas: **Pedidos** (apartados "En curso" e "Historial"), **Chats** (lista de conversaciones),
**Avisos** (campana) y **Perfil** (desde el avatar).

## Flujo del artesano

| # | Pantalla | Qué muestra | Acción principal |
|---|---|---|---|
| 1 | Tablero (CU-05) | Fecha y tres números del día (Nuevas, En proceso, Listos); bloques Solicitudes nuevas, En proceso por fase, Listos para entregar | Ver solicitudes nuevas |
| 2 | Solicitud (CU-03) | Fotos y nota del cliente | Hacer presupuesto |
| 3 | Enviar presupuesto (CU-04) | Monto, fecha de entrega, detalle | Enviar |
| 4 | Chat (CU-03) | Conversación con el cliente | Escribir |
| 5 | Pedido (CU-05) | Fase actual y línea de tiempo; **avanzar pide la foto en el momento** | Avanzar fase |
| 6 | Listo (CU-05) | Fase 4 terminada | Avisar al cliente |
| 7 | Entregar (CU-06) | Escanear QR o escribir el PIN | Confirmar entrega |
| 8 | Historial | Entregados del más reciente al más viejo, filtros por mes y servicio, resumen (entregados, a tiempo, calificación) | Ver detalle |

Cada tarjeta del Tablero lleva su acción directa ("Hacer presupuesto", "Entregar").
**Mi taller** (CU-07: datos, horario, fotos, servicios, reseñas, Publicar taller) se abre desde el avatar.

## Acceso (CU-01)

1. Bienvenida: "No lo tires, restáuralo." con Iniciar sesión, Crear cuenta y Continuar con Google.
2. Crear cuenta: nombre, correo, contraseña, aceptación de términos y aviso de privacidad.
3. Verificación: código de 6 dígitos y reenvío con cuenta regresiva.
4. Rol: "Soy cliente" o "Soy artesano".
5. Completar perfil: foto, nombre, edad, dirección.

## Componentes base

- **Botón principal:** fondo acento, texto blanco, ancho completo en móvil; uno por pantalla.
- **Botón secundario:** blanco con borde fuerte. **Botón de texto:** solo texto en acento (Cancelar, Ver detalle).
- **Tarjeta:** blanca con borde y esquinas de 12 px.
- **Etiqueta de estado:** píldora con fondo suave y texto fuerte.
- **Barra de fases:** 4 segmentos; los hechos en azul marino y los pendientes en `#E4E4E7`.
- **Línea de tiempo de fases:** completada (círculo verde con palomita), actual (círculo azul marino con anillo
  `#E8EEF6`), pendiente (círculo con borde gris).
- **Burbujas del chat:** propias en azul marino con texto blanco; del otro en blanco con borde.
- **Tarjeta de presupuesto en el chat:** borde naranja, precio grande, Rechazar (secundario) y Aceptar (principal).
- **Aviso flotante:** aparece abajo unos segundos; si trae ruta, se puede tocar para abrir la pantalla.

## Reglas de interfaz

- Mobile-first; en escritorio la barra de navegación pasa al costado.
- Textos y mensajes de error en español, claros y cortos; botones con verbo ("Pedir cotización", "Avanzar fase").
- Accesibilidad: contraste de 4.5:1 o más, tamaños táctiles de 44 px, texto alternativo en las fotos, foco visible.
