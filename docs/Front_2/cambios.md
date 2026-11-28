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

### 9. Escritorio: detalle del negocio a todo el ancho — IMPLEMENTADO

- Ruta `#/taller/:id` de la **vista de cliente** (en la simulación, «Calzado El Buen Paso»; el mismo contenedor que muestra el negocio del usuario).
- Antes: `.pantalla.perfil-taller` heredaba `max-width: var(--ancho-pantalla)` (1120 px en PC) y `--pantalla-margen-izquierdo` la centraba dentro del espacio libre de la barra lateral, dejando franjas vacías a ambos lados (a 1536 px: `x=324`, `right=1444`, con 77 px libres a la derecha).
- **Cambio:** `front/css/perfil-taller.css`, solo bajo `html[data-escritorio]`: la pantalla pasa a `width: calc(100% - var(--nav-ancho))`, `max-width: none`, `margin-left: var(--nav-ancho)` y `position: relative`; `.barra`, `.pantalla__cuerpo` y `.perfil-taller__contenido` pasan a `width: 100%` / `max-width: none`. La barra superior se mide dentro de la pantalla (`left: 0; right: 0; margin: 0`) y el banner superior (`.perfil-taller__portada .foto`, ya `width: 100%`) ocupa todo el ancho disponible sin tocar el HTML.
- **Verificación:** en la app real (API simulada inyectada solo en el navegador de prueba): a 1024 px la pantalla sigue en `x=232`, `w=777`, `right=1009` (ya llenaba el espacio); a 1440 px pasa de `x=276, w=1120, right=1396` a `x=232, w=1193, right=1425`; a 1536 px pasa de `x=324, w=1120, right=1444` a `x=232, w=1289, right=1521`. En los tres casos `scrollWidth` coincide con el ancho útil de la ventana (sin desborde horizontal) y la barra y el banner tienen exactamente el mismo `x` y ancho que la pantalla. A 390 px no cambia nada (`x=0`, `w=390`, banner de 390 px, `scrollWidth=414` igual que `innerWidth`): el diseño móvil sigue intacto. Sin errores de consola.

### 10. Detalle del negocio: acciones rápidas circulares sobre el banner — IMPLEMENTADO

- «Cómo llegar» y «Compartir» dejan de ser dos botones anchos en la columna derecha. Ahora son dos botones circulares de **44×44 px**, solo con ícono, dentro de `.perfil-taller__portada` (el contenedor del banner), en `top: 16px; right: 16px` con `gap: 8px`, a la altura del botón circular «Volver» de la esquina izquierda.
- **Cambio:** `front/js/features/map/pages/perfil-taller.js` — `crearAccionesRapidas` genera los mismos enlace/botón con sus `href`/`target`/`rel` y su `navigator.share`, pero sin texto visible y con `aria-label` y `title` («Cómo llegar» y «Compartir»). El contenedor se inserta dentro de la portada, no en la hoja de contenido.
- **Cambio:** `front/css/perfil-taller.css` — `.acciones-rapidas` es `absolute` con `z-index: 20` y las medidas pedidas; `.accion-rapida` es circular de 44 px con **fondo blanco sólido**, sin `backdrop-filter`, borde y `var(--sombra-1)` como «Volver», foco visible y `:active`. El degradado del banner (`.perfil-taller__portada .foto`, incluido el respaldo `.foto--inicial`) conserva su `background` pero pasa a `position: relative; z-index: 10; pointer-events: none`, para que no se dibuje ni reciba toques por encima de los botones. La barra superior sube a `z-index: 30` y deja pasar el toque (`pointer-events: none`) salvo en `.barra__volver` (`pointer-events: auto`). **Causa real de los botones grises/borrosos:** la `.barra` base conservaba `backdrop-filter: blur(10px)` y, al estar encima, desenfocaba todo lo que tenía debajo; se anula con `backdrop-filter: none` (y `-webkit-backdrop-filter: none`) solo en `.perfil-taller .barra`.
- **Cambio:** la cuadrícula de escritorio pasa de `"encabezado rapidas" / "servicios horario"` a `"encabezado horario" / "servicios horario"`: Horario sube a la columna derecha y desaparece el hueco de los botones anchos. En móvil el orden de la hoja sigue siendo encabezado → servicios → trabajos → horario.
- **Verificación:** forzando el respaldo con degradado (`linear-gradient(rgb(194, 65, 12), rgb(194, 65, 12))`) a 1440 px los dos círculos quedan en `x=1313`/`x=1365`, `y=16`, `44×44`, con 8 px entre ellos y su borde derecho a 16 px del banner (`right=1425`). A 390 px quedan en `x=278`/`x=330` dentro de un banner de 390 px. En ambos anchos: degradado en `z-index: 10` con `pointer-events: none`, contenedor de botones en `z-index: 20`, botones con `background: rgb(255, 255, 255)` y `backdrop-filter: none`, y ningún ancestro con `overflow` distinto de `visible` u `opacity` distinto de `1` que cree otro contexto de apilamiento. `document.elementFromPoint` en el centro de cada botón devuelve el botón; «Volver» sigue recibiendo el toque. Captura de pantalla leída píxel a píxel: antes del arreglo el centro del botón era `rgb(230,230,229)` (blanco mezclado con el fondo por el `blur` de la barra) y después es `rgb(255,255,255)` tanto a 1440 px como a 390 px; el ícono del segundo botón mide `rgb(62,62,65)`. Sin desborde horizontal ni errores. El enlace conserva `https://www.google.com/maps/dir/?api=1&destination=20.9674,-89.5926` con `target="_blank"` y `rel="noopener noreferrer"`; al pulsar «Compartir» se llama a `navigator.share` con el título, texto y URL anteriores.

### 11. Detalle del negocio: tarjeta blanca separada del banner — IMPLEMENTADO

- Antes: `.perfil-taller__hoja` tenía `margin-top: -24px` pero solo `padding: 24px 16px` en móvil (separación neta **0 px**) y `margin-top: -40px` con `padding: 36px 40px` en escritorio (el título quedaba **4 px dentro del banner**). Además usaba `background: var(--color-hueso)` (`rgb(247,247,248)`) y no tenía `z-index`, mientras el banner (`.foto`) tiene `z-index: 10`, así que el banner se dibujaba encima del solapamiento.
- **Cambio:** `front/css/perfil-taller.css` — la hoja conserva el solapamiento ligero (`-mt-6` = `-24px`, también en escritorio), pasa a `padding: 32px 24px 24px` (`pt-8` y 24 px horizontales), `border-radius: 24px 24px 0 0` (`rounded-t-3xl`), `background: var(--color-superficie)` (blanco sólido) y `position: relative; z-index: 10`. Al ir después del banner en el DOM, su fondo blanco tapa la franja solapada sin subir por encima de los botones (`z-20`) ni de la barra (`z-30`).
- **Cambio:** `.perfil-taller__horario` usa el mismo relleno horizontal de 24 px; el carrusel compensa con `margin: 0 -24px` / `padding: 2px 24px` para seguir llegando a los bordes de la tarjeta; y en escritorio el CTA alinea su margen derecho a 24 px. Se hace explícito `margin-top: 0` en `.perfil-taller__encabezado` y `.perfil-taller__horario` para que «Horario» arranque en la misma línea que el título.
- **Sin cambios:** los dos círculos del banner siguen en `top: 16px; right: 16px`, `44×44`, `gap: 8px`, fondo blanco y sin `backdrop-filter`.
- **Verificación:** en la app real con API simulada inyectada solo en el navegador de prueba: a 1440 px la hoja va de `y=280` a `y=296` (solapa 24 px sobre un banner que termina en `y=320`), el título de `y=316` a `y=328`, es decir **8 px por debajo del banner**; «Horario» está en `y=328`, el mismo `margin-top: 0` que el título, y el padding horizontal es 24 px tanto en el título como en servicios y columna derecha. A 390 px el título pasa de `y=220` a `y=228`, también con 8 px de separación. Captura leída píxel a píxel: la franja solapada mide `rgb(255,255,255)` a 1440 y 390 px (antes mostraba el banner), y el centro de «Cómo llegar» sigue en `rgb(255,255,255)`. `elementFromPoint` sigue devolviendo ambos botones y «Volver», sin desborde horizontal nuevo.

### 12. Detalle del taller: CTA siempre visible y menos espaciado — IMPLEMENTADO

- Antes: el CTA era un elemento hermano de la hoja con `.acciones { margin-top: auto }`, `position: fixed` resuelto **dentro de `.pantalla__cuerpo`** (la animación de entrada deja un `transform` y crea bloque contenedor), de modo que a 390 px medía `bottom=999` con una ventana de 844 px: quedaba cortado. El cuerpo reservaba 160 px de relleno inferior y la columna derecha era ancha; servicios y precio tenían 16 px internos y la hoja 24 px de gap.
- **Cambio:** `front/js/features/map/pages/perfil-taller.js` — el precio, Horario y el CTA ahora viven en un mismo `.perfil-taller__lateral`; el precio se extrajo a `crearPrecio()` y ya no está dentro de «Servicios». Los dos círculos del banner siguen intactos.
- **Cambio:** `front/css/perfil-taller.css` — `.perfil-taller .pantalla__cuerpo` lleva `animation: none` (también con `html[data-navegacion]`) para que el CTA `fixed` se mida contra la ventana, y `padding-bottom: 88px` para que no tape el último bloque. El CTA es barra blanca con `box-shadow: 0 -4px 16px …`, `padding: 12px 16px` y `margin: 0` (anula el `margin-top: auto` base).
- **Cambio:** se reduce el gap vertical de la hoja de 24 a 20 px; `.servicio` y `.precio-desde` pasan a 12 px de relleno; el precio tiene `max-width: 448px` (`max-w-md`); la pantalla usa `height: auto; min-height: 100dvh` en escritorio en vez de estirarse.
- **Cambio:** en escritorio la hoja es `minmax(0, 1fr) 320px` con áreas `encabezado/lateral`, `servicios/lateral` y `trabajos/trabajos`. La columna derecha es `position: sticky; top: 16px`, con 16 px de gap, y contiene precio + Horario + CTA; el CTA dentro es `sticky; bottom: 16px`, blanco, con sombra y 12 px de relleno. En móvil la hoja sigue siendo una sola columna y el CTA vuelve a ser `fixed` sobre la navegación.
- **Verificación:** en la app real con API simulada inyectada solo en el navegador de prueba, sin errores de consola: a 1440×900 el CTA mide `320×72` en `x=1096, y=532`, visible sin scroll, dentro de la columna derecha de 320 px junto al precio (`y=328`) y Horario (`y=456`); la hoja pasa a 562,9 px de alto (antes 685,2). A 1280×720 el CTA sigue visible en `y=532`. A 390×844 el CTA es `fixed` en `x=0, y=712, bottom=784`, justo sobre una navegación que empieza en `y=784` (antes `bottom=999`, fuera de la vista); el cuerpo reserva 88 px y no hay desborde horizontal. Los botones circulares conservan sus posiciones (`x=1328/1380` a 1440 px; `x=278/330` a 390 px).

### 13. Botón «Volver» consistente: historial con respaldo — IMPLEMENTADO

- Antes: el Volver de Avisos apuntaba a `#/` (la portada) y el de Calificar a `#/pedidos`, sin importar desde dónde se llegó. Los enlaces no tenían manejador común; el router, eso sí, navega con `window.location.hash` y no usa `location.replace`, `replaceState`, `pushState` ni `history.go`, así que el historial sí se conserva.
- **Cambio:** `front/js/ui/dom.js` — nuevo `volverConHistorial(evento)`: ignora clics con modificador, y si hubo navegación interna dentro de la app, hace `preventDefault()` + `window.history.back()`; si no la hubo, deja que el enlace siga su `href` de respaldo. Para distinguir ambos casos se cuenta `hashchange` en `sessionStorage` (`mixanab:navegaciones-internas`), instalado al cargar el módulo; si `sessionStorage` no está disponible se usa `history.length > 2` (una pestaña nueva arranca con `about:blank` + la URL).
- **Cambio:** `front/js/ui/layout.js` — `crearPantalla()` crea el Volver con esa función compartida, con `aria-label`/`title` «Volver» y `#/principal` como respaldo. Por eso lo heredan todas las pantallas generadas por el layout: detalle del taller, chats, pedidos, solicitudes, admin, acceso, etc.
- **Cambio:** `front/js/features/requests/pages/avisos.js` — el respaldo del cliente pasa de `#/` a `#/principal` (el artesano conserva `#/artesano/solicitudes`).
- **Cambio:** `front/js/features/orders/pages/calificar.js` — el botón de cierre (`.barra__volver` con `aria-label` «Cerrar») usa el mismo manejador.
- **Sin cambios:** `front/js/features/quotes/pages/presupuesto.js` sigue actualizando el `href` del Volver a `#/chat/:id`; el handler lo respeta como respaldo y prefiere el historial. Las pruebas que leen `href` (`flujo-pantallas.test.js`, `ui.test.js`) siguen válidas porque los enlaces se conservan.
- **Verificación:** en la app real con API simulada inyectada solo en el navegador de prueba, sin errores de consola: (1) `#/principal` → campana → `#/avisos` → clic en Volver regresa a `#/principal` por `history.back()`; (2) `#/avisos` abierto directo en pestaña nueva (`history.length=2`) → clic en Volver navega a `#/principal` por el `href` de respaldo; (3) el detalle del taller muestra Volver con `href="#/mapa"`, `aria-label="Volver"`, `title="Volver"` y el mismo handler. Suite `ui.test.js`: 9/9; `flujo-pantallas.test.js` sigue deteniéndose en `adjuntarFoto` por `USAR_API_SIMULADA = false` del `apis/config.js` del usuario (fallo previo, ajeno a este cambio).

### 14. Resultados de talleres: filtros en capa flotante anclada al embudo — IMPLEMENTADO

- Antes: el `<form class="filtros">` vivía dentro de `.pantalla__cuerpo` y alternaba `hidden`, así que al abrirlo se insertaba en el flujo y empujaba la lista y los chips hacia abajo. El botón no tenía `aria-controls` y no había cierre con Esc ni fondo atenuado.
- **Cambio:** `front/js/features/map/pages/talleres.js` — el panel sale del cuerpo y se monta dentro de `.talleres__filtro-ancla`, junto al embudo, que se pasa como `accion` de la barra. El fondo se cuelga directamente de `.pantalla` (no del cuerpo, que conserva un `transform` de animación y sería bloque contenedor del `fixed`). Nuevo encabezado con botón «Cerrar filtros», botón secundario «Limpiar» (deja los valores iniciales, aplica y cierra), `aria-controls="filtros-talleres"`, `aria-expanded` y `aria-hidden` sincronizados.
- **Cambio:** abrir bloquea el scroll del `body` compensando el ancho de la barra de desplazamiento con `padding-right`, mueve el foco al primer control (en `requestAnimationFrame`) y registra Esc; cerrar devuelve el foco al embudo, quita el listener y restaura el scroll. `alSalir()` cierra sin robar el foco al cambiar de ruta. «Aplicar filtros» y el fondo también cierran. El badge del embudo sigue mostrándose cuando hay filtros aplicados.
- **Cambio:** `front/css/talleres.css` — el panel y el fondo son `fixed`, fuera del flujo. En móvil el panel es una hoja inferior (`bottom: 0`, `max-height: 85dvh`, esquinas `20px 20px 0 0`) que sube con `translateY(100%) → 0` en 200 ms (salida 150 ms). En escritorio (`html[data-escritorio]`) es un popover `absolute; top: calc(100% + 8px); right: 0; width: 380px` con `transform-origin: top right`, `scale(0.85) translateY(-8px) → scale(1) translateY(0)` en 200 ms, `::before` con el pico apuntando al botón y `overflow-y: auto`. El fondo es `rgb(0 0 0 / 20%)` con `z-index: 40`; el panel `z-index: 50` y la barra sube a `60` mientras está abierto. El embudo abierto pasa a fondo `--color-cuero` con ícono blanco. `prefers-reduced-motion` anula escala y desplazamiento y deja solo el fundido.
- **Causa técnica corregida:** la `.barra` base conserva `animation: entrada-pantalla` con `transform` activo (identidad) y `backdrop-filter: blur(10px)`; cualquiera de los dos convierte a la barra en bloque contenedor, así que el panel `fixed` se medía contra la barra y la hoja móvil salía arriba (`bottom=55`). Se anula la animación y el desenfoque solo en `.pantalla.talleres > .barra`. También hubo que poner `bottom: auto` en la regla de escritorio, porque la base móvil fijaba `bottom: 0` y el popover quedaba comprimido a 32 px.
- **Verificación:** en la app real con API simulada inyectada solo en el navegador de prueba, sin errores de consola: a 1440×900 el popover abierto mide `380×647,5` en `x=1000, y=57,5`, con su borde derecho en `1380` — el mismo que el embudo (`x=1336, right=1380, bottom=49,5`)—, `transform-origin: 380px 0px`, pico visible y sombra. A 390×844 la hoja abierta va de `y=196,5` a `bottom=844` a todo el ancho, con `max-height=717,4` (85 % de 844). En ambos anchos la lista permanece exactamente en `x=300, y=155,5, 1072×260` y `x=16, y=147,5, 358×512` antes, durante y después de abrir; el fondo cubre toda la ventana con `rgba(0,0,0,0.2)`, el embudo pasa a `rgb(194,65,12)` con ícono blanco y `aria-expanded="true"`, el foco va al `select` y vuelve al botón al cerrar. Cierran Esc, el fondo, el botón X, «Aplicar filtros» y «Limpiar»; con filtros aplicados el badge queda visible y «Limpiar» lo apaga. Con `prefers-reduced-motion: reduce` el `transform` es `none` en ambos estados. Sin desbordes nuevos.

### 15. Resultados de talleres: header transparente y pico del popover sin corte — IMPLEMENTADO

- Antes: la `.barra` base pintaba un fondo `color-mix(in srgb, var(--color-hueso) 88%, transparent)` con `backdrop-filter: blur(10px)`, visible como una franja clara sobre el fondo de la página. Además, el pico `::before` vivía dentro del panel, que tiene `overflow-y: auto`, y quedaba recortado: entre el embudo y el popover había un hueco visual.
- **Cambio:** `front/css/talleres.css` — `.pantalla.talleres > .barra` pasa a `background: transparent` con un degradado sutil `var(--color-hueso) → transparente` (no existe el token `--bg`; el fondo de la app es `--color-hueso`), `border-bottom: 0`, `box-shadow: none` y `backdrop-filter: none` también cerrado. Se conserva `animation: none` para no crear bloque contenedor y el `z-index: 60` solo con el panel abierto. El título sigue siendo solo texto y los dos círculos (Volver 40 px y filtro 44 px) mantienen fondo blanco y `sombra-1`; el filtro sigue neutro cerrado y pasa a `--color-cuero` con ícono blanco solo abierto, con su badge cuando hay filtros.
- **Cambio:** el pico se mueve de `.talleres__filtros::before` a `.talleres__filtro-ancla::before`, limitado a escritorio y al estado `talleres--filtros-abiertos`. El ancla no tiene `overflow`, así que el rombo de 12 px (`top: calc(100% + 2px)`, `right: 16px`, rotado 45°, blanco con borde) tapa los 8 px de separación sin recortarse.
- **Verificación:** en la app real con API simulada inyectada solo en el navegador de prueba, a 1440×900 y 390×844 con `#/talleres?servicio=repair` (título «Reparación»): barra `position: sticky`, `backgroundColor: rgba(0,0,0,0)`, `backgroundImage: linear-gradient(rgb(247,247,248) 0%, … 60%, transparent 100%)`, `borderBottom: 0px`, `boxShadow: none`, `backdropFilter: none`, `animation: none`, `transform: none`. Muestreo de píxeles del header cerrado: `247,247,248` en toda la franja — el mismo color que el fondo, sin franja blanca. Volver blanco `rgb(255,255,255)` con `border-radius: 50%` y sombra; filtro cerrado blanco con ícono `rgb(24,24,27)` y abierto `rgb(194,65,12)` con ícono blanco; badge visible tras aplicar filtros. El pico solo tiene `content: ""` con el panel abierto (`top: 46px` desde el ancla → `y=52`, `right: 16px`) y el barrido de píxeles en `x=1358` es continuo de `y=50` a `y=59` (borde del botón → rombo blanco → borde del panel → panel blanco), sin hueco ni corte. La lista sigue inmóvil y no hay errores de consola.

### 16. Mi perfil: contenido angosto y centrado, tarjetas uniformes — IMPLEMENTADO

- Antes: en escritorio `.pantalla__cuerpo` tenía `max-width: 760px` y `margin-inline: 180px` dentro de la pantalla de 1120 px, y el relleno lateral se aplicaba en ese contenedor. El resultado era un bloque de 712 px desplazado respecto del centro del área útil; además la tarjeta del avatar llevaba `border-radius: 18px` y las listas `12px`, sin borde las unas ni las otras.
- **Cambio:** `front/css/perfil-cliente.css` — el cuerpo ya no aporta relleno lateral (`padding-inline: 0`) ni margen propio (`margin-inline: 0` en escritorio) y ocupa todo el ancho de la pantalla. El título y `.perfil-cliente__contenido` comparten `width: 100%`, `max-width: 720px`, `margin-inline: auto` y `padding-inline: 16px`; con `html[data-escritorio]` el relleno pasa a 24 px. Así el centro del bloque coincide con el centro del espacio a la derecha de la barra lateral (232 px), sin `padding-left` ni `margin-left` extra.
- **Cambio:** `.perfil-encabezado` y las dos `.perfil-lista` comparten ahora `border: 1px solid var(--color-borde)`, `border-radius: var(--radio-tarjeta)` (12 px) y `box-shadow: var(--sombra-1)`, además del mismo ancho al ser hijos directos del contenedor.
- **Verificación:** en la app real con API simulada e iniciada solo en el navegador de prueba: a 1440×900 la barra lateral mide 232 px, el cuerpo va de `x=276` a `1396` sin margen propio, y el título y el contenedor miden `720 px` en `x=476…1196` (centro `836` = centro del área `232…1440`) con `padding: 0 24px`. Avatar, «Mis datos» y «Mi actividad» miden los tres `672 px` en `x=500…1172`, con `1px solid rgb(228,228,231)` y radio `12px`. A 800×900 (barra lateral de 88 px) el contenedor se adapta a 680 px con 16 px de relleno y las tarjetas a 648 px. A 390×844 el contenedor ocupa el ancho completo (390 px) con `padding: 0 16px` y las tres tarjetas van en `x=16…374` (358 px), conservando el relleno inferior de 84 px para la navegación. Sin errores de consola.

## Estado final

- Las ventanas de prueba se cerraron y sus perfiles temporales se eliminaron.
- El servidor en `:5500` quedó intacto.
- Los cambios se entregan en la rama `front/google-y-busquedas`: botón «Continuar con Google», vista de búsquedas en móvil y escritorio, lámina móvil desplegable y arrastrable desde todo su borde, detalle del negocio a todo el ancho en escritorio, acciones rápidas circulares sobre el banner, tarjeta blanca separada del banner y alineada en 24 px, CTA siempre visible con columna derecha sticky y espaciado reducido, botones «Volver» con `history.back()` y respaldo a Inicio, panel de filtros flotante anclado al embudo en escritorio y hoja inferior en móvil, header de talleres transparente con pico continuo, Mi perfil con contenedor de 720 px centrado y tarjetas uniformes, y este reporte con su evidencia.
- `apis/config.js` se dejó fuera del commit (cambio previo del usuario) y queda modificado en el working tree.
- Para corregir los hallazgos 2 y 3 hace falta autorización explícita, para no afectar el trabajo del compañero.
