# Mejoras del frontend

Lista viva de mejoras visuales y de experiencia (rama `feat/rediseno-ui`). Lo terminado se marca `[x]` y se tacha
con el commit que lo hizo; lo pendiente queda `[ ]`, en el orden en que se va a hacer, una por una.

## Hecho

- [x] ~~Tipografía, jerarquía y estilo base del rediseño (paleta cuero de la guía de Figma)~~
- [x] ~~Pantallas del cliente, acceso y artesano con el nuevo diseño; vista de escritorio con barra lateral~~
- [x] ~~Reparación y Limpieza llenan el ancho en escritorio~~ (`6eac325`)
- [x] ~~Servicios de Tu taller como tarjetas de color~~ (`a334f2c`)
- [x] ~~Horario de Tu taller más legible e insignias de estado sólidas en toda la app~~ (`94defe2`)
- [x] ~~Zapato de trazo único en Bienvenida en lugar de la llave~~ (`e03481a`)
- [x] ~~Mi taller: tarjeta de perfil más grande y descripción opcional del taller~~ (`c76b8aa`)
- [x] ~~Animación al cambiar de pantalla y navegación con botones separados~~ (`cc77104`)
- [x] ~~Margen parejo y botones más compactos en la barra del celular~~ (`6f1570e`)
- [x] ~~Volver arriba y foco en el título al navegar (lector de pantalla)~~ (`4a86597`)
- [x] ~~Franja "Sin conexión" y reintento automático al volver la red~~ (`4a86597`)
- [x] ~~Avisos flotantes de confirmación (guardar, publicar, enviar, actualizar fase)~~ (`4a86597`)
- [x] ~~Validación de formularios mientras se escribe~~ (`e3301fb`)
- [x] ~~Animación según la dirección (avanzar / regresar)~~ (`e3301fb`)
- [x] ~~Etiquetas de la navegación a 12px~~ (`e3301fb`)
- [x] ~~Estados vacíos con ilustración en el estilo de la marca~~ (`e3301fb`)
- [x] ~~Modo oscuro con selector de tema y gris de texto secundario con contraste AA~~ (`326e7df`)
- [x] ~~La franja "Sin conexión" ya no tapa la barra superior ni la lateral~~ (`fc8a158`)
- [x] ~~Contraste del modo oscuro revisado en chat, presupuesto, solicitud, seguimiento, actualizar fase, recoger, verificar entrega, calificar y las 6 pantallas de admin: todo ≥4.5:1, sin cambios necesarios~~ (revisión)
- [x] ~~Reglas de escritorio sin duplicar: 47 reglas repetidas pasan a una sola con `html[data-escritorio]`~~ (`fcb8df7`)
- [x] ~~Versión del caché calculada del contenido (`npm run cache:version`) y prueba que avisa si se olvida o falta un archivo en `INTERFAZ`~~ (`0005fda`)
- [x] ~~Prueba de punta a punta por las pantallas (solicitud → chat → presupuesto → fases → entrega → calificación) con el router real; encontró y corrigió el aviso de "Fase actualizada" mal ubicado~~ (`33c5d46`)
- [x] ~~Medición con Lighthouse y mejoras de carga: librerías con `defer` y `leaflet.css` solo al abrir un mapa~~ (`7879f2d`)

## Pendiente (en orden)

- [ ] Inicio: el elemento más grande es un mosaico del mapa de OpenStreetMap; Lighthouse lo simula en 11.1 s (real: 1.1 s). Opción: mostrar el minimapa hasta que la pantalla ya cargó.

## Dependen de otra persona

- [ ] Columna `workshops.description` en la base de datos, su permiso y `COLUMNAS_TALLER` en `api.js` (Angel).
- [ ] Atajo "Entrar como cliente" del modo simulado no inicia la sesión en la autenticación simulada (Angel).

## Mediciones con Lighthouse

Lighthouse 13.6.0, celular, 4G lento simulado (150 ms, 1.6 Mbps), servidor local sin compresión (`npm run dev`).
En producción, con gzip o brotli, la carga sería menor.

| Pantalla | Rendimiento | Accesibilidad | Buenas prácticas | Primer contenido (FCP) | Contenido principal (LCP) |
|---|---|---|---|---|---|
| Bienvenida (`#/acceso`), antes | 78 | 100 | 100 | 4.0 s | 4.0 s |
| Bienvenida (`#/acceso`), después | 98 | 100 | 100 | 2.0 s | 2.0 s |
| Inicio (`#/principal`), después | 73 | 100 | 96 | 2.0 s | 11.1 s simulado (1.1 s real) |

Qué se cambió: `supabase.js`, `leaflet.js` y `qrcode.js` se cargan con `defer` (antes bloqueaban la primera pantalla 2.3 s)
y `leaflet.css` se carga al abrir el primer mapa. Se probó precargar los 110 módulos (`modulepreload`) y no mejoró, así que
no se dejó.

