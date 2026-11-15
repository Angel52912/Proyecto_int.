DOCS LEIDOS: contrato-api.md, diseno.md, requisitos.md, decisiones/*
STACK DETECTADO: JavaScript ES6+ sin framework / CSS plano (tokens.css y components.css) / router propio por hash (js/router.js) / iconos SVG propios (js/components/icon.js)

# Lógica detectada

| Fase | Pantalla | Dato / Acción | Nivel (1/2/3) | Archivo existente o mock creado |
|------|----------|---------------|---------------|----------------------------------|
| 01 | Base | Navegación y rutas del cliente | 1 | `js/router.js`, `js/features/*/routes.js` |
| 01 | Base | Iconos de la interfaz | 2 | `js/components/icon.js` (no hay librería de iconos instalada) |
| 01 | Base | Talleres de muestra para las fases 02–06 | 2 | `js/mocks/workshops.js` |
| 01 | Base | Mapa de talleres | 3 | `js/components/ui.js` (`MapBackdrop`, `MapPin`): mapa estilizado, sin proveedor real |
| 01 | Perfil (stub) | Perfil del usuario | 1 | `js/features/auth/index.js` (`getMyProfile`); el stub no lo consume todavía |
| 02 | Inicio | Nombre del usuario | 2 | `js/mocks/orders.js` (`currentUser`); en modo simulado no hay sesión |
| 02 | Inicio | Pedido en curso | 2 | `js/mocks/orders.js` (`currentOrder`) |
| 02 | Inicio | Búsqueda de talleres | 3 | El buscador navega a `/mapa`; no filtra |
| 02 | Inicio | Notificaciones | 3 | Botón sin acción |
| 02 | Inicio | Vista previa del mapa | 3 | `MapBackdrop` estilizado, sin proveedor real |
| 03 | Mapa | Mapa real y pines georreferenciados | 3 | `MapBackdrop` y `MapPin` estilizados; Leaflet está instalado pero no hay componente de mapa |
| 03 | Mapa | Selección de taller con pines y tarjetas | 1 | Estado local de `MapScreen` |
| 03 | Mapa | Filtros de chips | 3 | Solo cambia el chip activo; no filtra pines |
| 03 | Mapa | Datos de los talleres | 2 | `js/mocks/workshops.js` (`workshops`, `getWorkshopById`) |

## Contradicciones encontradas

1. **Stack:** las fases suponen un framework y `src/`. El proyecto es JavaScript ES6+ sin framework, con router por hash y carpetas `js/features/`. Se respetó la estructura existente (`js/components/`, `js/mocks/`, `js/features/<modulo>/view.js`).
2. **Tokens de diseño:** la fase 01 propone valores estimados; `docs/diseno.md` define la paleta base. Se conservan los tokens existentes de `tokens.css` (Cuero, Cenote, Miel, Espresso, Hueso, Arena) y se añadieron alias y tonos de estado/mapa que la guía deja por definir.
3. **Tipografías:** la fase sugiere cargar Google Fonts; la decisión abierta de `0001-arquitectura.md` y la CSP del proyecto usan Poppins/Inter con fallback del sistema. No se añadió CDN.
4. **Mocks:** la fase pide `src/mocks/workshops.ts`; se creó `js/mocks/workshops.js` para respetar la estructura del proyecto. Los nombres de campo de contrato se conservan; `tags`, `description` y `hours_label` quedan marcados como texto de presentación.
5. **Git:** la fase pide `git add -A`; `CLAUDE.md` prohíbe ese comando. Se usa `git add` selectivo, con un solo commit por fase.
6. **Mapa real:** el proyecto incluye Leaflet, pero no existe todavía un componente de mapa. Se implementó `MapBackdrop` estilizado como Nivel 3, sin conectar proveedor.
