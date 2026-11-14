---
description: Para José. Corre las pruebas RLS, revisa cobertura por rol y escribe las que falten
---

Verifica las pruebas del backend gastando los menos tokens posibles.
1. Corre `npm run test:rls` con reporte mínimo. No pegues logs completos.
2. Revisa en `tests/rls/` que haya pruebas por cada rol (cliente, artesano, admin, sin rol, anónimo) y por cada flujo alternativo de los CU implementados.
3. Propón en una tabla los casos que faltan (rol, acción, resultado esperado).
4. Escribe solo pruebas en `tests/rls/`. **No edites migraciones, `supabase/` ni `api.js`**: si algo falla por el backend, repórtalo a Angel.
5. Responde en máximo 20 líneas: una por suite (✅ o ❌ y número de pruebas), fallos con archivo, prueba y causa probable, y la tabla de casos faltantes.
