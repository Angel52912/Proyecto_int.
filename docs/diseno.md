# Diseño de MiXanab

Fuente: sección "Bakubs" (mockups) y "Wireframes" del tablero. Estilo: **artesanal moderno**.
Prototipo: "MiXanab · Mockups" en Figma. Wireframes: enlace de Canva en el tablero.

## Tokens

| Color | Nombre | Hex |
|---|---|---|
| Principal | Cuero | `#7A4A2A` |
| Secundario | Cenote | `#1F7A7A` |
| Acento | Miel | `#E0A33A` |
| Texto | Espresso | `#2B211B` |
| Fondo | Hueso | `#FAF6F0` |
| Superficie | Arena | `#E7DED3` |

Estados de la guía: Éxito, Aviso, Error e Info (colores por definir en Figma).

| Uso | Fuente |
|---|---|
| Título | Poppins 26 |
| Subtítulo | Poppins 20 |
| Texto y campos | Inter 15 |
| Secundario | Inter 13 |

Componentes de la guía: botón principal, botón secundario, mapa, campo de texto.
Navegación inferior del cliente: Inicio · Mapa · Pedidos · Perfil.
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
