---
description: Recomienda qué caso de uso (CU) implementar ahora, si juntos o por separado
---

Decide qué casos de uso conviene implementar a continuación. **No escribas código ni edites archivos**: solo recomienda.

Contexto mínimo (no leas más): los checklists de `docs/requisitos.md`, el orden de `CLAUDE.md` y `git log --oneline -n 10`.

**Juntar** CU en una sola sesión si comparten tablas y roles y suman pocas casillas (aprox. 8 o menos).
**Separar** (una sesión por CU) si el CU es grande o fundacional (CU-01), usa Storage o Realtime (CU-03, CU-05),
maneja el PIN o las calificaciones (CU-06), o depende de datos que otro CU aún no crea.

Dependencias: CU-01 → CU-07 → CU-02 → CU-03 → CU-04 → CU-05 → CU-06 → CU-08 (administración, al final).

Responde en máximo 12 líneas: siguiente sesión (CU y si van juntos), por qué, los 2 pasos siguientes,
modelo sugerido (ligero para implementar, potente solo para diseñar) y el comando listo: `/implementar-cu ...`.
