---
description: Implementa solo las pantallas de un CU contra api.js simulado
argument-hint: CU-XX
---

Implementa solo las **pantallas** de: **$ARGUMENTS**

Antes de escribir código:
1. Lee ese CU en `docs/requisitos.md`, sus pantallas en `docs/diseno.md` y las funciones en `docs/contrato-api.md`.
2. Revisa de forma puntual el código existente que vas a tocar.
3. Muestra un plan de máximo 10 líneas (pantallas, componentes, estados). Continúa salvo que haya una duda real.

Implementación:
4. Rama `feat/<cu>-ui`.
5. Mobile-first con los tokens de `css/tokens.css`; textos en español; una hoja CSS por pantalla.
6. Trabaja contra `api.mock.js` (`USAR_API_SIMULADA = true`). **Nunca llames a Supabase directo**: solo importa el `api.js` del módulo.
7. Texto del usuario siempre escapado (`textContent`, nunca `innerHTML`).
8. Cada pantalla con estados de carga, vacío y error.
9. Si el contrato no alcanza, **pide el cambio al backend** (Angel) en lugar de inventarlo. No edites `supabase/` ni `api.js` real.

Cierre:
10. Corre `npm run lint` y `npm test` con salida mínima y corrige fallos.
11. Marca en `docs/requisitos.md` solo las casillas que funcionan y están probadas.
12. Un commit por pantalla o componente, con archivos por nombre, sin `git add -A` y sin push.
13. Resume en máximo 8 líneas, incluyendo lo que falta pedir al backend. Recuérdame `/usage`.

Reglas: sin dependencias nuevas sin justificar; sin imprimir logs completos.
