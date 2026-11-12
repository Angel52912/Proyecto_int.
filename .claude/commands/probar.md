---
description: Corre lint y pruebas con salida mínima (solo fallos)
---

Ejecuta la verificación gastando los menos tokens posibles.
1. Corre `npm run lint --if-present` y `npm test` con reporte silencioso o mínimo.
2. **No pegues los logs completos.** Responde con una línea por suite (✅ o ❌ y número de pruebas) y, por cada fallo,
   archivo, nombre de la prueba y causa probable en una línea. Máximo 20 líneas.
3. Si hay fallos, propón la corrección pero **no la apliques** hasta que yo confirme.
