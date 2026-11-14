---
description: Recomienda qué caso de uso (CU) implementar ahora, si juntos o por separado
---

Decide qué casos de uso conviene implementar a continuación. **No escribas código ni edites archivos**: solo recomienda.

Contexto mínimo (no leas más): los checklists de `docs/requisitos.md`, el orden de `CLAUDE.md` y `git log --oneline -n 10`.

**Juntar** CU en una sola sesión si comparten tablas y roles y suman pocas casillas (aprox. 8 o menos).
**Separar** (una sesión por CU) si el CU es grande o fundacional (CU-01), usa Storage o Realtime (CU-03, CU-05),
maneja el PIN o las calificaciones (CU-06), o depende de datos que otro CU aún no crea.

Orden de entrega del backend (`CLAUDE.md`, sección "Equipo y responsabilidades"): base + CU-01 → CU-07 → CU-03 → CU-04 → CU-05 → CU-06 → CU-02 → CU-08 (administración, al final).
El frontend puede avanzar un CU antes con `api.mock.js`, siguiendo `docs/contrato-api.md`.

Responde en máximo 14 líneas: siguiente CU del orden de entrega (y si van juntos), por qué, los 2 pasos siguientes,
modelo sugerido (ligero para implementar, potente solo para diseñar) y, por rol, qué hace cada quien con ese CU:
- Backend (Angel): `/implementar-backend CU-XX`.
- Frontend (Milton o Abraham, según el reparto de pantallas): `/implementar-pantalla CU-XX` contra el simulado.
- Pruebas (José): `/probar-backend` cuando el backend del CU se fusione.
Solo si una persona hace todo: `/implementar-cu CU-XX`.
