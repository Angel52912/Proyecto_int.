# Integración de los dos frontends

Dos personas construyeron las pantallas del cliente en paralelo, sobre las mismas rutas:

- **Milton** (`feature/frontend`, PR #9): prototipo visual por fases (`front/js/components/`, `front/js/mocks/` y `view.js` por módulo). Las fases están en esta carpeta (`00_LEEME_PRIMERO.md` a `11_...`), con `LOGICA_DETECTADA.md` y `PROGRESO.md`.
- **Abraham** (`feat/cliente-ui`, PR #10, y `feat/front-unificado`, PR #11): pantallas de cliente **y artesano** en `front/js/features/<modulo>/pages/` con la capa de interfaz en `front/js/ui/`.

## Qué quedó en `main`

Base: **el frontend de Abraham** (`feat/front-unificado`, que incluye todo `feat/cliente-ui`). Motivos:

| | Abraham | Milton |
|---|---|---|
| Rutas | 26 (cliente y artesano) | 11 (solo cliente) |
| Mapa | Leaflet real con pines | Mapa estilizado sin proveedor (`MapBackdrop`) |
| Datos | `api.mock.js` del contrato (`docs/contrato-api.md`) | Datos fijos en `front/js/mocks/` con `TODO(BACKEND)` |
| Pruebas | pantallas, DOM, estados, chat y QR | sin pruebas propias de pantallas |
| Accesibilidad | roles ARIA, pestañas con teclado, estados cargando, error y vacío | parcial |

De Milton se conserva:

- Esta carpeta `docs/frontend/` completa (las fases y la lógica detectada).
- Todo su historial: `feature/frontend` está fusionada como padre del commit de integración, así que su código (`front/js/components/`, `front/js/mocks/` y los `view.js` por módulo) sigue en la historia de Git. Para verlo: `git show origin/feature/frontend:js/features/map/view.js`.

No se llevó al árbol de trabajo (Abraham ya lo cubre con el contrato): `front/js/components/`, `front/js/mocks/`, los `view.js` de Milton, sus tokens y estilos de pantalla, y el cambio de `<main id="app">` a `<div>` en `front/index.html` (el diseño de Abraham necesita el `<main>`).

La rama `revert-9-feature/frontend` (un `Revert` del PR #9) **no se fusiona**: deshacería el trabajo de Milton que se conserva en el historial.

## Pendiente de decidir entre Milton y Abraham

- Reparto de pantallas: `CLAUDE.md` asignaba Acceso, Artesano y Admin a Milton, y Cliente a Abraham. Las pantallas de **Admin** (CU-08) no existen en ninguna de las dos ramas.
- Si Milton quiere rescatar algo concreto de su prototipo (por ejemplo, su set de iconos o un componente), debe proponerlo como cambio aparte sobre esta base.
