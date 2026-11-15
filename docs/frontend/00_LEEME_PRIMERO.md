# 00 — LEEME PRIMERO (REGLAS GENERALES)

> Eres un agente de programación. Esta carpeta contiene 11 fases (`01_...` a `11_...`).
> **Tu trabajo es SOLO el FRONTEND (vistas).** Sigue las instrucciones al pie de la letra.
> No interpretes, no mejores, no improvises. Si algo no está escrito aquí, NO lo hagas.
> Si algo es ambiguo o imposible, DETENTE y escribe al usuario qué falta. No adivines.

---

## 1. CONTEXTO DEL PROYECTO

- App: marketplace de restauración y limpieza de calzado/artículos de piel en **Mérida, Yucatán, México**.
- Idioma de TODA la interfaz: **español**. Copia los textos EXACTAMENTE como están en cada fase (acentos, mayúsculas, signos ¿?, símbolos `·`).
- Hay 11 pantallas de rol **Cliente**. Cada fase construye pantallas concretas.
- Debe ser **ADAPTATIVO**: móvil (teléfono) y escritorio (PC). Ver sección 6.
- Las pantallas del diseño original son de 390 px de ancho (móvil). La versión escritorio la defino yo en cada fase; síguela.

## 1.1 DOCUMENTACIÓN EXISTENTE DEL PROYECTO (OBLIGATORIA)

El repositorio YA tiene documentación de reglas en la carpeta `docs/`. Contiene, como mínimo:
- `docs/decisiones/` (carpeta con decisiones técnicas tomadas)
- `docs/contrato-api.md`
- `docs/diseno.md`
- `docs/requisitos.md`

**Antes de la fase 01 y al INICIO de cada fase debes leer COMPLETOS esos archivos** (y todos los archivos dentro de `docs/decisiones/`). Son las reglas del proyecto y las debes RESPETAR.

Reglas de uso:
1. **NUNCA modifiques, borres ni renombres** nada dentro de `docs/` que no sea `docs/frontend/` (esta carpeta).
2. `docs/contrato-api.md`: los nombres de campos, tipos y formas de datos de tus **mocks (Nivel 2) deben coincidir con este contrato**. Si el contrato define una entidad (taller, pedido, presupuesto, mensaje, calificación), tu mock usa esos nombres de campo, no los inventados en estas fases. Los textos visibles siguen siendo los de la fase.
3. `docs/diseno.md`: si define colores, tipografías, espaciados o componentes, **tienen prioridad sobre los tokens estimados de la fase 01**. Usa los de `diseno.md` y, si coinciden en concepto, ignora el valor de la fase.
4. `docs/requisitos.md`: define el alcance. No construyas nada que contradiga un requisito. Si un requisito dice que algo NO se hace, no lo hagas.
5. `docs/decisiones/*`: decisiones técnicas ya tomadas (stack, convenciones, estructura de carpetas, nombres). Respétalas por encima de lo que sugiere esta carpeta.
6. **Prioridad cuando haya contradicción:**
   - Stack, convenciones de código, nombres de rutas, tokens de diseño, formas de datos y alcance → **gana `docs/` existente**.
   - Reglas de git (rama, 11 commits, push), los 3 niveles de lógica, "solo frontend" y la lista negra → **ganan estas fases (`docs/frontend/`)**.
   - Si no puedes decidir cuál aplica → **DETENTE y pregunta al usuario**. No elijas tú.
7. En `docs/frontend/LOGICA_DETECTADA.md` añade, al inicio, la línea `DOCS LEIDOS: contrato-api.md, diseno.md, requisitos.md, decisiones/*` y, en cada fase, anota cualquier contradicción encontrada y cuál regla aplicaste.

## 2. RAMA DE GIT (OBLIGATORIO)

El usuario YA creó la rama de trabajo con:

```
git checkout -b feature/frontend
```

- **Trabaja SIEMPRE y SOLO en `feature/frontend`.**
- Al iniciar cada fase ejecuta `git branch --show-current`. Si NO imprime exactamente `feature/frontend` → **DETENTE** y avisa al usuario. **NO crees ramas. NO cambies de rama. NO hagas merge. NO hagas rebase. NO uses `--force`. NO uses `--amend`.**

## 3. REGLA DE COMMITS Y PUSH (OBLIGATORIO)

- Hay **11 fases = exactamente 11 commits** en total. Ni uno más, ni uno menos.
- **1 commit por fase.** El mensaje de cada commit viene escrito en la fase. Úsalo tal cual.
- **Cuándo se hace el commit (DEFINICIÓN EXACTA):** el commit de cada fase se hace en el **LÍMITE ENTRE FASES**: es el cierre de la fase N y, a la vez, el punto de arranque limpio de la fase N+1.
  - Al terminar la fase N: `git add` → `git commit` → `git push`. Ese es el ÚNICO commit de la fase N.
  - Al iniciar la fase N+1: NO hagas ningún commit. Solo verifica que el commit de la fase N existe, que está subido (`git status` no dice "ahead") y que el árbol está limpio. Recién entonces empiezas a trabajar.
  - Prohibido hacer commits de "inicio de fase", commits intermedios o commits vacíos. Total final: 11 commits.
- Flujo de CADA fase, en este orden:
  1. **INICIO DE FASE:** ejecuta `git branch --show-current` (debe ser `feature/frontend`) y `git status --short`.
     - Fases 02 a 11: el resultado de `git status --short` debe estar VACÍO y `git log --oneline` debe mostrar el commit de la fase anterior. Si no, DETENTE y avisa.
     - Fase 01: es la única en la que pueden aparecer sin seguimiento (untracked) los archivos de `docs/frontend/`. Se incluyen en el commit de la fase 01.
  2. Lee los archivos de `docs/` (sección 1.1) y la fase completa antes de escribir código.
  3. Haz el trabajo de la fase.
  4. Ejecuta la **verificación** (sección 8 y los criterios de aceptación de la fase).
  5. Marca la fase en `docs/frontend/PROGRESO.md` (cambia `[ ]` por `[x]`).
  6. `git add -A` → `git commit -m "<mensaje de la fase>"` → `git push` (en la fase 01 usa `git push -u origin feature/frontend`).
  7. Confirma que `git status` dice "working tree clean" y que no está "ahead". Solo entonces pasa a la siguiente fase.
- **FIN DE FASE = PUSH.** No avances sin haber hecho push.
- NO subas: `node_modules`, `.env*`, builds (`dist`, `.next`, `build`), archivos de sistema. Si no están en `.gitignore`, NO los añadas al commit (usa `git add` selectivo en lugar de `-A` y avisa al usuario).
- Si el commit falla (hooks, lint), arréglalo y vuelve a intentar. NO uses `--no-verify`.

## 4. STACK (DETECCIÓN OBLIGATORIA, SIN ADIVINAR)

El usuario puede rellenar esto. Si está vacío, detéctalo tú:

```
FRAMEWORK:        [ ] (ej. React+Vite / Next.js / Vue / Nuxt / Svelte / Angular / otro)
ESTILOS:          [ ] (ej. Tailwind / CSS Modules / styled-components / SCSS / CSS plano)
ROUTER:           [ ] (el que ya exista en el proyecto)
LIBRERÍA ICONOS:  [ ] (la que ya exista; si no hay ninguna → iconos SVG propios)
```

Cómo detectar si está vacío:
1. Lee `package.json` (dependencies y devDependencies) y la estructura de carpetas.
2. Usa EXACTAMENTE el framework, estilos y router que YA estén instalados.
3. **NO instales dependencias nuevas.** NO cambies `package.json`. NO migres de tecnología.
4. Si no puedes determinar el framework con certeza → DETENTE y pregunta al usuario.
5. Usa los nombres/convenciones de carpetas que YA existan (`components`, `pages`, `views`, `screens`, etc.). Si no existe ninguna, crea `src/components/` y `src/screens/`.
6. En este documento "pantalla" = el componente/página/vista completo; "componente" = pieza reutilizable.

## 5. LÓGICA: LOS 3 NIVELES (LO MÁS IMPORTANTE)

Eres **frontend**. La lógica de negocio/backend la hacen otros. Tu trabajo es **conectar pantallas** con la lógica que YA EXISTE. Antes de cada pantalla debes clasificar cada dato y cada acción en uno de estos niveles:

### NIVEL 1 — YA EXISTE → CONÉCTALO
Si en el repositorio ya hay un servicio, hook, store, API client, endpoint, función o tipo para ese dato/acción:
- Impórtalo y úsalo desde la pantalla.
- **NO modifiques** ese archivo. **NO lo dupliques.** **NO lo renombres.**

### NIVEL 2 — NO EXISTE, pero la pantalla lo necesita para verse o navegar → MOCK
- Crea los datos de ejemplo SOLO en `src/mocks/` (o la carpeta equivalente), con tipos TypeScript si el proyecto usa TypeScript.
- Los mocks deben reproducir EXACTAMENTE los valores del diseño (nombres, precios, fechas, textos).
- Marca cada mock con el comentario: `// TODO(BACKEND): reemplazar por lógica real`.
- Prohibido en un mock: `fetch`, `axios`, `localStorage` para simular backend, `setTimeout` que simule servidor.

### NIVEL 3 — LÓGICA DE NEGOCIO/BACKEND → NO LA PROGRAMES
Está prohibido implementar: autenticación, pagos, cálculo real de precios, tiempo real/WebSockets, subida real de archivos, geolocalización real, mapa con proveedor externo nuevo, generación/validación real de QR o PIN, notificaciones push, envío real de mensajes, guardado real de calificaciones.
- Deja la pieza visual completa y expón un callback vacío: `onSubmit`, `onAccept`, etc., con `// TODO(BACKEND):`.
- Si el callback no existe como Nivel 1, el botón solo navega (si aplica) o no hace nada. Nunca finjas que funciona.

### Lo que SÍ puedes programar (es frontend)
Estado de UI local: pestañas activas, chips seleccionados, campos de formulario controlados, abrir/cerrar, estrellas seleccionadas, navegación entre pantallas, estilos, responsive, accesibilidad.

### Procedimiento obligatorio antes de CADA pantalla
1. Busca en el repo (carpetas `services`, `api`, `hooks`, `store`, `lib`, `utils`, `types`, backend si está en el monorepo) estas palabras: `pedido`, `order`, `taller`, `workshop`, `servicio`, `cotizacion`, `quote`, `presupuesto`, `chat`, `message`, `rating`, `resena`, `review`, `usuario`, `user`.
2. Anota en `docs/frontend/LOGICA_DETECTADA.md` una tabla (créala en la fase 01, añade filas en cada fase):

   | Fase | Pantalla | Dato / Acción | Nivel (1/2/3) | Archivo existente o mock creado |
   |------|----------|---------------|---------------|----------------------------------|

3. Aplica el nivel que corresponda. **Si dudas entre Nivel 1 y Nivel 2, es Nivel 2 (mock).** No modifiques lógica existente por ningún motivo.

## 6. ADAPTATIVO (MÓVIL + PC)

Breakpoints (mobile-first, usa estos números EXACTOS):
- **Móvil:** 0 – 767 px
- **Tablet:** 768 – 1023 px
- **Escritorio:** ≥ 1024 px

Reglas globales (la fase 01 las implementa en el `AppShell`; las demás fases las respetan):
- Móvil: layout idéntico al diseño. Barra de navegación inferior fija (Inicio, Mapa, Pedidos, Perfil).
- Tablet: igual que móvil pero el contenido se centra con ancho máximo de 720 px; las listas pueden usar 2 columnas donde la fase lo indique.
- Escritorio: la barra inferior DESAPARECE y aparece una **barra lateral izquierda** (240 px) con los mismos 4 destinos. El contenido va a la derecha con padding 32 px y ancho máximo 1120 px, centrado en su área.
- Los botones fijos al fondo (ej. "Solicitar cotización") son `position: fixed` abajo SOLO en móvil/tablet. En escritorio pasan a ser **parte del flujo** del contenido (no fijos), alineados como indique la fase.
- Nunca scroll horizontal. Nunca ancho fijo en px para contenedores (usa `max-width` + `width: 100%`).
- Zonas táctiles mínimas de 44×44 px.
- Respeta `env(safe-area-inset-bottom)` en barras fijas inferiores.

## 7. COSAS QUE NO DEBES HACER (LISTA NEGRA)

1. NO dibujes la barra de estado del teléfono (la hora "9:41" y el icono de batería). Es parte del marco del mockup, **NO existe en la app**.
2. NO cambies, traduzcas ni "mejores" ningún texto.
3. NO inventes pantallas, botones, secciones ni textos que no estén en la fase. Única excepción: la pantalla "Perfil" (fase 01) que es un stub mínimo.
4. NO uses colores, tamaños, radios o sombras fuera de los tokens de la fase 01. NO hardcodees hex en componentes.
5. NO uses emojis. Todos los iconos son SVG (ver fase 01).
6. NO instales paquetes. NO edites `package.json`, lockfiles, configs de build, CI ni backend.
7. NO muevas, borres ni renombres archivos existentes que no sean tuyos.
8. NO modifiques tests existentes. NO escribas lógica de negocio.
9. NO hagas más de 1 commit por fase. NO hagas commits vacíos.
10. NO avances de fase sin push. NO saltes fases. NO combines fases.
11. NO uses `any` si el proyecto usa TypeScript; tipa los mocks.
12. NO dejes `console.log`, código comentado ni archivos temporales.
13. Si algo no está definido → DETENTE y pregunta. NO lo inventes.

## 8. VERIFICACIÓN DE CADA FASE (antes de commit)

Ejecuta, si existen en `package.json > scripts`: `lint`, `typecheck` (o `tsc --noEmit`) y `build`. Todos deben terminar SIN errores. Si un script no existe, sáltalo (no lo crees).
Además revisa por código (o en navegador si dispones de él) con anchos **360 px, 768 px y 1280 px**:
- No hay scroll horizontal.
- Los textos coinciden carácter por carácter con la fase.
- Los botones/enlaces navegan a las rutas indicadas.
- La barra inferior aparece <1024 px y la lateral ≥1024 px (cuando la pantalla usa shell con navegación).

## 9. MAPA DE RUTAS (usa estas; si el router ya tiene una ruta equivalente, reutilízala SIN renombrarla)

| Pantalla | Ruta | Fase |
|---|---|---|
| Inicio | `/` | 02 |
| Mapa | `/mapa` | 03 |
| Lista de talleres (Reparación / Limpieza) | `/talleres/:categoria` (`reparacion`, `limpieza`) | 04 |
| Detalle de taller | `/taller/:tallerId` | 05 |
| Solicitar cotización | `/taller/:tallerId/cotizar` | 06 |
| Chat | `/chat/:pedidoId` | 07 |
| Presupuesto | `/pedido/:pedidoId/presupuesto` | 08 |
| Seguimiento de pedido | `/pedido/:pedidoId` | 09 |
| Recoger pedido (QR/PIN) | `/pedido/:pedidoId/recoger` | 10 |
| Calificar experiencia | `/pedido/:pedidoId/calificar` | 10 |
| Mis pedidos | `/pedidos` | 11 |
| Perfil (stub) | `/perfil` | 01 |

IDs de mock a usar: `tallerId = "don-chucho"` (y `"los-hermanos"`, `"la-ermita"`, `"santiago"`), `pedidoId = "1042"`.

## 10. ÍNDICE DE FASES

| Fase | Contenido | Mensaje de commit |
|---|---|---|
| 01 | Fundación: tokens, shell adaptativo, componentes base | `feat(frontend): fase 01 - fundacion, tokens, shell adaptativo y componentes base` |
| 02 | Pantalla Inicio | `feat(frontend): fase 02 - pantalla Inicio` |
| 03 | Pantalla Mapa | `feat(frontend): fase 03 - pantalla Mapa` |
| 04 | Lista de talleres (Reparación) | `feat(frontend): fase 04 - lista de talleres` |
| 05 | Detalle de taller | `feat(frontend): fase 05 - detalle de taller` |
| 06 | Solicitar cotización | `feat(frontend): fase 06 - solicitar cotizacion` |
| 07 | Chat | `feat(frontend): fase 07 - chat` |
| 08 | Presupuesto | `feat(frontend): fase 08 - presupuesto` |
| 09 | Seguimiento de pedido | `feat(frontend): fase 09 - seguimiento de pedido` |
| 10 | Recoger pedido + Calificar experiencia | `feat(frontend): fase 10 - recoger pedido y calificacion` |
| 11 | Mis pedidos + revisión final | `feat(frontend): fase 11 - mis pedidos y revision final` |

Empieza ahora por `01_FASE_FUNDACION.md`.
