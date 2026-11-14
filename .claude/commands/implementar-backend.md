---
description: Implementa solo el backend de un CU (SQL, RLS, api.js real y simulado, pruebas RLS)
argument-hint: CU-XX
---

Implementa solo el **backend** de: **$ARGUMENTS**

Antes de escribir código:
1. Lee ese CU en `docs/requisitos.md`, su plan en `docs/decisiones/0001-arquitectura.md` y las reglas de seguridad de `CLAUDE.md`.
2. Revisa de forma puntual el código existente que vas a tocar.
3. Muestra un plan de máximo 10 líneas (tablas, políticas RLS, funciones, `api.js`, pruebas). Continúa salvo que haya una duda real.

Implementación:
4. Rama `feat/<cu>-backend`.
5. Migración SQL nueva en `supabase/migrations/` con RLS en cada tabla y bucket (nunca edites una ya aplicada). **No la apliques**: lo hace Angel tras confirmar.
6. Lógica sensible en funciones `security definer` con `search_path = ''`; `execute` revocado a `public` y `anon`, concedido a `authenticated`.
7. `api.js` real y `api.mock.js` con **la misma forma** de respuesta y de errores (`error.code`). No toques pantallas ni `css/`.
8. Actualiza `docs/contrato-api.md` en el mismo commit que cada cambio de `api.js`.
9. Pruebas en `tests/rls/` por cada rol: cliente, artesano, admin, sin rol y anónimo, más cada flujo alternativo del CU.

Cierre:
10. Corre `npm run lint` y las pruebas con salida mínima y corrige fallos. No marques casillas de `docs/requisitos.md` que dependan de la pantalla.
11. Un commit por cada cambio lógico (migración, función SQL, api, contrato, pruebas), con archivos por nombre, sin `git add -A` y sin push.
12. Resume en máximo 8 líneas: qué debe probar José y qué pueden consumir ya Milton y Abraham. Recuérdame `/usage`.

Reglas: sin dependencias nuevas sin justificar; sin cambiar la matriz de permisos sin avisar; sin imprimir logs completos.
