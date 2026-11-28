# Diseño de MiXanab

Fuente: sección "Bakubs" (mockups) y "Wireframes" del tablero. Estilo: **artesanal moderno**.
Prototipo: "MiXanab · Mockups" en Figma. Wireframes: enlace de Canva en el tablero.

## Tokens

| Rol | Nombre | Hex | Uso |
|---|---|---|---|
| Fondo | Blanco cálido | `#F7F6F3` | Fondo de las pantallas |
| Superficie | Blanco | `#FFFFFF` | Tarjetas, chat, formularios |
| Superficie alterna | Gris arena | `#EFEDE8` | Filtros, pestañas, mensajes recibidos |
| Borde | Gris claro | `#E2DED6` | Separadores y bordes |
| Texto | Casi negro | `#1F1B16` | Títulos y texto (15.8:1) |
| Texto secundario | Gris cálido | `#5E574F` | Detalles y fechas (6.6:1) |
| **Acento** | **Cuero quemado** | **`#9C4A1F`** | Botones, pestaña activa, enlaces (6.2:1 con blanco) |
| Acento oscuro | Cuero oscuro | `#7E3A16` | Hover y presionado |
| Acento suave | Durazno claro | `#F6E8DF` | Lo seleccionado, mensajes enviados |
| Secundario | Verde petróleo | `#0E6E66` | Información, mapa |
| Barra de navegación | Casi negro | `#1F1B16` | Fondo de la barra; la pestaña activa en el acento |

Rediseño de noviembre de 2026 (revisión: "poco intuitivo"): paleta moderna y minimalista con un solo acento.
Los nombres de los tokens en `front/css/tokens.css` se conservan (`--color-cuero` es el acento, `--color-hueso` el fondo,
`--color-espresso` el texto) para no tocar cada pantalla.

Estados: Éxito `#17693B`, Aviso `#8C5007`, Error `#B42318`, Info `#0E6E66` (todos ≥5.4:1 sobre el fondo).

| Uso | Fuente |
|---|---|
| Título | Poppins 26 |
| Subtítulo | Poppins 20 |
| Texto y campos | Inter 15 |
| Secundario | Inter 13 |

### Modo oscuro

Se activa con el sistema (`prefers-color-scheme`) o con el selector "Tema de color" de Perfil y Mi taller
(Automático, Claro, Oscuro; se guarda en el dispositivo). Usa los mismos tokens con otros valores; la barra de
navegación, Verificar entrega, las tarjetas en degradado y los avisos flotantes conservan sus colores.

| Token | Claro | Oscuro |
|---|---|---|
| Fondo (`--color-hueso`) | `#FAF6F0` | `#1A1411` |
| Texto (`--color-espresso`) | `#2B211B` | `#F3ECE4` |
| Superficie | `#FFFFFF` | `#261D18` |
| Cuero | `#7A4A2A` | `#D9A273` |
| Cenote | `#1F7A7A` | `#5CC2C2` |
| Miel | `#E0A33A` | `#E8B04F` |
| Texto suave | `#6E6259` | `#C8B9AB` |

Contraste mínimo medido en oscuro: 5.0:1 (texto gris sobre tarjeta suave); texto principal 15.6:1.
Texto sobre botones de color: blanco en claro, `#1A1411` en oscuro (≥7.5:1). Sobre miel siempre espresso.

Componentes de la guía: botón principal, botón secundario, mapa, campo de texto.
Navegación inferior del cliente: Inicio · Mapa · Pedidos · Chats · Perfil.
Navegación inferior del artesano: Solicitudes · Tablero · Chats · Perfil.

## Pantallas por flujo

### Acceso (CU-01)
1. Bienvenida: "No lo tires, restáuralo." con Iniciar sesión, Crear cuenta y Continuar con Google.
2. Crear cuenta: nombre, correo, contraseña, aceptación de términos y aviso de privacidad.
3. Verificación: código de 6 dígitos y reenvío con cuenta regresiva.
4. Rol: "Soy cliente" o "Soy artesano".
5. Completar perfil: foto, nombre, edad, dirección.

### Cliente
- Inicio (CU-02): saludo, buscador, categorías Reparación y Limpieza, talleres cercanos, pedido en curso.
- Mapa (CU-02): búsqueda en Mérida, filtros (Todos, Reparación, Limpieza, Abierto) y tarjeta del taller.
- Lista de talleres (CU-02): orden por más cercanos, mejor valorados o precio.
- Perfil del taller (CU-02): calificación, servicios, trabajos recientes, botón Solicitar cotización.
- Solicitar cotización (CU-03): fotos, tipo de servicio, descripción, Enviar solicitud.
- Chat (CU-03): conversación con el taller y tarjeta de presupuesto.
- Presupuesto (CU-04): desglose, total, entrega, tiempo, Aceptar o Rechazar ("pagas al recoger").
- Seguimiento (CU-05): fase 3 de 4, barra de progreso, línea de tiempo de fases, fotos de avance.
- Recoger pedido (CU-06): código QR y PIN, cómo llegar.
- Calificación (CU-06): etiquetas, reseña opcional, Enviar calificación.
- Mis pedidos: Activos e Historial.

### Artesano
- Tu taller (CU-07): nombre, fotos, dirección, ubicación, servicios, Publicar taller.
- Solicitudes (CU-03): Nuevas, En taller y calificación; lista de solicitudes.
- Solicitud (CU-04): fotos, descripción y formulario de presupuesto (costo, fecha, detalle).
- Tablero (CU-05): Kanban de 4 columnas; al mover un pedido se pide una foto.
- Mover fase (CU-05): selector de fase y nota opcional para el cliente.
- Verificar entrega (CU-06): escanear QR o ingresar PIN.
- Chats: lista de conversaciones.
- Mi taller: calificación, reseñas, pedidos entregados y porcentaje a tiempo.

## Reglas de interfaz

- Mobile-first; barra superior con la hora (9:41) es solo parte del mockup.
- Textos y mensajes de error en español, claros y cortos.
- Accesibilidad: contraste suficiente sobre Hueso, tamaños táctiles cómodos, texto alternativo en imágenes.
