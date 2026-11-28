# Reporte de vistas — Front_2

**Fecha:** 2026-11-27 (timestamp CDP `2026-11-28T02:48Z`)  
**Rama de entrega:** `front/google-y-busquedas` (desde `Remake`, a su vez desde `origin/FrontNuevoNvo`, commit `ee03cb5`)  
**Servidor:** `http://127.0.0.1:5500` (preexistente, no se detuvo)  
**Sesiones:** dos cuentas reales iniciadas por el usuario en perfiles aislados de Chrome  
**Alcance de los cambios:** se tocó el botón «Continuar con Google» y la vista de búsquedas (`#/mapa`) para ambos entornos (móvil y escritorio). No se modificó backend.

## Resumen ejecutivo

Se recorrieron las vistas de **talabartero** y **cliente** con sesión real, en escritorio (1536 px), móvil (390 px) y móvil estrecho (320 px). Se capturaron 32 pantallas y se hizo una pasada de estrés de 21 navegaciones rápidas por rol.

**No se modificó ningún código durante la prueba.** Solo se generaron las capturas en `docs/Front_2/evidencia/` y este reporte.

| Resultado | Cantidad |
|---|---|
| Vistas recorridas | 16 + 2 detalles de taller |
| Capturas | 32 PNG |
| Problemas de vista confirmados | 2 (1 ya corregido antes, 1 nuevo) |
| Errores runtime nuevos | 3 (solo en el mapa del cliente, bajo estrés) |
| Desbordes horizontales de página | 0 |

## Metodología

- Chrome aislado con CDP: puerto `9222` = talabartero, puerto `9223` = cliente.
- Rutas del talabartero: `/artesano/tablero`, `/artesano/solicitudes`, `/artesano/taller`, `/artesano/perfil`, `/artesano/avisos`, `/artesano/historial`, `/artesano/chats`.
- Rutas del cliente: `/principal`, `/mapa`, `/talleres`, `/pedidos`, `/avisos`, `/perfil`, `/chats`, más 2 fichas de taller.
- Por cada ruta: captura escritorio, captura móvil 390 px, métricas de `scrollWidth` vs `innerWidth`, contraste WCAG calculado y revisión de accesibilidad básica.
- Auditoría adicional a 320 px.
- Recolección de `Runtime.exceptionThrown`, `Log.entryAdded` y `console.error`.

Limitación: el cálculo automático de contraste no interpreta `background-image: linear-gradient(...)` ni `color-mix()`; los casos afectados se verificaron por separado y se marcan como falsos positivos más abajo.

## Hallazgos

### 1. Botón «Continuar con Google» — CORREGIDO antes de esta prueba

- **Causa:** `front/css/nuevo-front.css` se carga después de `front/css/acceso.css` (`index.html`, líneas 39 y 44) y su `.boton { color: #fff; }` sobrescribía `.boton--blanco { color: var(--color-espresso); }`.
- **Corrección previa:** solo en `front/css/nuevo-front.css`:
  - `.boton--blanco { color: var(--color-espresso); }`
  - exclusión de `.boton--blanco` del hover oscuro genérico;
  - hover claro propio.
- **Validación en esta prueba:** al inyectar un botón con esas clases, el estilo computado es `color: rgb(24,24,27)` sobre `background: rgb(255,255,255)`, contraste **17.72:1**. Queda resuelto.

### 2. «Agregar horario» en blanco sobre miel — NUEVO, NO corregido

- **Ruta:** `/artesano/taller`.
- **Elemento:** `button.boton.boton--miel.horario__agregar` (varios botones de horario).
- **Estilo computado:** `color: rgb(255,255,255)` sobre `background: rgb(217,154,43)` → contraste aprox. **2.44:1** (mínimo recomendado 4.5:1).
- **Causa:** la misma cascada que afectaba a Google: `.boton { color: #fff; }` en `nuevo-front.css` gana a `.boton--miel { color: var(--color-tinta); }` de `components.css`. En `front/css/taller.css:201` hay un comentario que indica que se quería texto espresso (7.1:1), pero el cascade lo anula.
- **Recomendación (NO aplicada):** añadir `.boton--miel { color: var(--color-tinta); }` después de la regla `.boton` en `front/css/nuevo-front.css`.
- **Evidencia:** `talabartero-artesano_taller-desktop.png`, `talabartero-artesano_taller-movil.png`.

### 3. Error runtime de Leaflet al navegar rápido — NUEVO

- **Rol:** cliente.
- **Dónde:** durante la pasada de estrés (21 cambios de hash rápidos entre `/principal`, `/mapa`, `/talleres`, etc.).
- **Error:** 3 × `Runtime.exceptionThrown` → `Uncaught (in promise)` en `front/js/vendor/leaflet.js`, función `_initIcon`.
- **Impacto:** Contaminación de consola y posible condición de carrera al destruir/recrear el mapa al salir de la ruta. No se observó una vista rota de forma persistente.
- **Recomendación (NO aplicada):** revisar la limpieza del mapa al cambiar de ruta y el ciclo de vida de los markers.
- **Evidencia:** `cliente-mapa-desktop.png`, `cliente-mapa-movil.png`.

### 4. Contraste límite en insignia de éxito — MENOR

- `.insignia--exito` en `/artesano/taller` y `/artesano/perfil`: `rgb(21,128,61)` sobre `rgb(232,245,236)` → **4.47:1** frente a 4.5:1 requeridos.
- Es un caso límite; opcionalmente oscurecer el texto (p. ej. `#166534`). No bloqueante.

## Falsos positivos descartados

- `span.foto__inicial` (iniciales «FC», «RS», «RS»): el auditor marcó 1.07:1, pero el fondo real es `var(--degradado-marca)`, no transparente. Las iniciales están sobre degradado de marca y son legibles.
- `h1.barra__titulo`: el auditor marcó 1.18:1 porque `getComputedStyle` devuelve `color(srgb ... / 0.92)` (de `color-mix()`) y el parser lo tomó como color oscuro. El fondo real es claro (`rgb(247,247,248)` con 92% de opacidad). No es un fallo.
- Mosaicos de Leaflet con `right > innerWidth` a 320 px: están dentro del contenedor recortado del mapa; `document.documentElement.scrollWidth` sigue siendo 320. No hay scroll horizontal de página.
- `button.chip` con `right = 347` a 320 px en `/talleres`: pertenece a `.chips { overflow-x: auto; }`, es una fila desplazable intencional. No hay desborde de página.

## Sin problemas detectados

- `scrollWidth === innerWidth` en todas las vistas a 1536, 390 y 320 px.
- Botones sin nombre accesible: **0**.
- Imágenes sin `alt`: **0**.
- Inputs sin etiqueta ni placeholder: **0**.
- Estados vacíos (solicitudes, pedidos, avisos, chats, historial) se renderizan con texto y sin desbordes.
- La navegación rápida del **talabartero** no generó errores nuevos (0).

## Contexto de red durante el login

En el perfil del talabartero aparecieron, antes de la navegación:

- `403` en `https://ehbkyysdzdwxzjbvccie.supabase.co/auth/v1/verify` (×2)
- `429` en `.../auth/v1/otp` (×1)

Ocurrieron durante el inicio de sesión manual y **no se repitieron** durante el recorrido ni el estrés. No son defectos de la vista.

## Evidencia

Las 32 capturas están en `docs/Front_2/evidencia/`. Las más relevantes:

- `cliente-principal-desktop.png` / `cliente-principal-movil.png`
- `cliente-mapa-desktop.png` / `cliente-mapa-movil.png`
- `cliente-talleres-desktop.png` / `cliente-talleres-movil.png`
- `cliente-detalle-taller_*-desktop.png` / `-movil.png`
- `talabartero-artesano_tablero-desktop.png` / `-movil.png`
- `talabartero-artesano_taller-desktop.png` / `-movil.png`
- `talabartero-artesano_perfil-desktop.png` / `-movil.png`

## Ajustes de vista pedidos después de la prueba

Solo CSS de vista: no se tocó backend ni la rama del compañero. Se midió con CDP sobre un DOM de prueba con la misma cascada de `index.html`, sin iniciar sesión ni escribir datos.

### 5. PC `#/mapa`: columna vacía entre el sidebar y el panel — CORREGIDO

- **Causa real:** `.pantalla__cuerpo` lleva `animation: entrada-pantalla … both` (`layout.css:228-235`). Con `animation-fill-mode: both`, el `transform` de los keyframes queda aplicado como matriz identidad al terminar y el cuerpo pasa a ser bloque contenedor de sus hijos `position: fixed`. Como el cuerpo ya empieza en `x=232` (ancho de la barra), el `left: var(--nav-ancho)` del panel se sumaba otra vez: panel en `x=464` y mapa en `x=844`, con una franja de 232 px entre barra y panel.
- **Descartado:** no hay `left`, `translateX` ni cálculo desde JavaScript para el panel (`front/js/features/map/pages/mapa.js` solo crea el DOM; el único movimiento es el de Leaflet dentro del lienzo).
- **Cambio:** `front/css/escritorio.css` — el cuerpo del mapa pasa a `flex-direction: row`, `gap: 0` y `animation: none` en escritorio; `.mapa__lateral` entra en flujo (`position: static`, `order: 1`, `flex: 0 0 400px`, `height: 100vh`) y `.mapa__lienzo` toma el resto (`position: static`, `order: 2`, `flex: 1 1 auto`, `min-width: 0`, `height: 100vh`).
- **Verificación:** a 1024, 1440 y 1536 px: barra `0–232`, panel `232–632`, mapa `632–viewport`; huecos **0 px**, `transform: none` en el cuerpo y `scrollWidth === innerWidth`.

### 6. Móvil: lámina del mapa separada de la barra inferior — CORREGIDO

- **Causa:** `--alto-nav: 60px`, pero la barra medía 55 px (1 px de borde + 4 px de relleno + 44 px de enlace + 6 px de relleno). Como `.mapa__tarjeta` usa `bottom: calc(var(--alto-nav) + env(safe-area-inset-bottom))`, quedaba un hueco de 5 px (según métricas del dispositivo puede verse como 1 px).
- **Cambio:** `front/css/nuevo-front.css` — altura explícita de `.nav-inferior`: `calc(var(--alto-nav) + env(safe-area-inset-bottom))`, limitada a `@media (max-width: 767px)` y a la vista forzada `html[data-vista="movil"]` para no afectar la barra lateral de tableta/PC.
- **Verificación:** a 390 px y con móvil forzado a 1200 px, `nav.top === tarjeta.bottom` (hueco **0 px**). A 900 px la navegación sigue lateral y no se altera.

### 7. Chips de filtro: «Abierto ahora» se cortaba — CORREGIDO

- `.chips` ya tenía `overflow-x: auto`, pero dentro del panel de 379 px la fila medía 428 px y el último chip quedaba recortado.
- **Cambio:** `front/css/mapa.css` — `.mapa__superior .chips` con `overflow-x: auto`, `white-space: nowrap`, scroll táctil y barra fina visible; `.mapa__superior .chip` con `padding-inline: 8px`.
- **Verificación:** a 1024/1440/1536 px (`clientWidth = scrollWidth = 399`) y a 390 px (`390/390`), los cuatro chips caben; el último termina en `x≈596` dentro de un contenedor que llega a `x≈631`. Si la ventana se reduce, la fila sigue desplazable.
- Se revirtió el cambio anterior en `front/css/talleres.css`: fue un diagnóstico equivocado (el problema estaba en `#/mapa`, no en `/talleres`).

### 8. Móvil: la lámina del mapa se despliega — IMPLEMENTADO

- `.mapa__asa` dejó de ser un `span` decorativo: ahora es un `button` de `56×32 px` con `aria-expanded`, `aria-controls` y etiqueta accesible («Ver/Ocultar lista de talleres»); la barrita visual queda como `::after`.
- El texto «Ver lista» de la lámina también es un botón: abre y cierra la misma lista (`Ocultar lista` cuando está abierta). Así el control visible funciona aunque el asa pase desapercibida.
- Todo el borde superior (`.mapa__borde`, 356 px de ancho a 390 px) es zona de arrastre: no hay que apuntar a la manecilla. El panel sigue el dedo/ratón en tiempo real (`max-height` en vivo) y al soltar se abre o cierra con un umbral de 36 px. Los toques simples en el asa y en «Ver lista» siguen funcionando después de arrastrar.
- **Cambio:** `front/js/features/map/pages/mapa.js` conserva ambos controles y el panel al repintar la lámina; al abrir muestra una lista móvil de resultados dentro de `.mapa__desplegable` (la lista de PC sigue intacta a la izquierda). Se cierra al tocar un taller de la lista, al elegir un pin, al buscar de nuevo y al salir de la ruta (`alSalir`). El enlace a `/talleres` sigue disponible en el icono de filtros del buscador.
- **Cambio:** `front/css/nuevo-front.css` — botones con foco visible, panel con `max-height: min(40dvh, 340px)` y scroll propio; el `bottom` de la lámina sigue siendo `calc(var(--alto-nav) + env(safe-area-inset-bottom))`.
- **Verificación:** en la app real (API simulada inyectada solo en el navegador de prueba) a 390×844: arrastrando desde el extremo derecho del borde (lejos de la manecilla), el panel sigue el gesto (`max-height` 150 px a mitad de subida, altura 150 px) y al soltar queda abierto (`y≈239.9`, `bottom=784`, 4 filas, `aria-expanded=true`). Al arrastrar hacia abajo baja a 237.6 px y se cierra. El arrastre táctil desde el borde también abre (90 px a mitad de gesto) y, justo después, los toques en «Ver lista» y en el asa siguen abriendo y cerrando. A 390×667 la lámina abierta queda por debajo de los chips. A 1024/1440 px la tarjeta sigue oculta y la lista de PC intacta. Sin errores de consola.

## Estado final

- Las dos ventanas de prueba se cerraron y sus perfiles temporales se eliminaron.
- El servidor en `:5500` quedó intacto.
- Los cambios se entregan en la rama `front/google-y-busquedas`: botón «Continuar con Google», vista de búsquedas en móvil y escritorio, lámina móvil desplegable y arrastrable desde todo su borde, y este reporte con su evidencia.
- `apis/config.js` se dejó fuera del commit (cambio previo del usuario) y queda modificado en el working tree.
- Para corregir los hallazgos 2 y 3 hace falta autorización explícita, para no afectar el trabajo del compañero.
