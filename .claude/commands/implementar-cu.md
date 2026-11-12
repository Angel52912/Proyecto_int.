---
description: Implementa uno o varios casos de uso (ej. /implementar-cu CU-03)
argument-hint: CU-01 [CU-07 ...]
---

Implementa: **$ARGUMENTS**

Antes de escribir código:
1. Lee solo esos CU en `docs/requisitos.md`, las pantallas relacionadas en `docs/diseno.md` y las reglas de seguridad de `CLAUDE.md`.
2. Revisa de forma puntual el código existente que vas a tocar.
3. Muestra un plan de máximo 10 líneas (tablas, políticas RLS, pantallas, pruebas). Continúa salvo que haya una duda real.

Implementación:
4. Rama `feat/<cu>-<tema>`.
5. Migración SQL nueva en `supabase/migrations/` con RLS en cada tabla y bucket (nunca edites una ya aplicada). **No la apliques**: yo lo hago.
6. Lógica sensible en funciones SQL `security definer` con `search_path = ''`, no en el navegador.
7. Pantallas mobile-first según `docs/diseno.md`, con los tokens de color y tipografía, en español.
8. Pruebas Jest: casos felices, errores y **permisos por rol** (qué puede y qué no cada actor).

Cierre:
9. Corre lint y pruebas con salida mínima y corrige fallos.
10. Marca en `docs/requisitos.md` solo las casillas que funcionan y están probadas.
11. Commit claro por CU, agregando archivos por nombre (no `git add -A`). No hagas push.
12. Resume en máximo 8 líneas y recuérdame `/usage` para la tabla de medición.

Reglas: sin dependencias nuevas sin justificar; sin cambiar la matriz de permisos sin avisar; sin imprimir logs completos.
