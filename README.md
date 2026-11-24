# MiXanab

"No lo tires, restáuralo." PWA para talleres de talabartería y calzado en Mérida, Yucatán.

## Estructura del repositorio

| Ruta | Contenido |
| --- | --- |
| `index.html` | Punto de entrada de la PWA (HTML y `<main id="app">`). |
| `manifest.webmanifest` | Instalación de la PWA e íconos. |
| `sw.js` | Service worker: precachea **solo la interfaz**. |
| [`front/`](front/README.md) | Diseño e interfaz: CSS, router, pantallas, íconos y pruebas unitarias. |
| [`apis/`](apis/README.md) | Capa de datos del navegador: acceso y APIs de MiXanab (real y simulada). |
| [`back/`](back/README.md) | Base de datos, permisos RLS, pruebas de permisos y scripts de npm. |
| `docs/` | Requisitos, diseño, contrato de APIs y decisiones arquitectónicas. |
| [`CLAUDE.md`](CLAUDE.md) | Reglas del equipo: léelo antes de implementar un caso de uso. |

La interfaz (`front/`) importa `apis/`, nunca `back/`. El back responde a través de
Supabase (RLS y funciones SQL) y de la capa `apis/`; no hay importaciones de `front/`
hacia `back/` y no hay servidor propio.

## Rutas principales

- `/` o `/inicio`: pantalla de inicio pública (logo, eslogan y **Iniciar sesión**).
- `/acceso`: bienvenida (iniciar sesión, crear cuenta o Google); el cliente entra a `/principal`.
- `/principal`: pantalla principal del cliente (antes `/inicio`).

## Cómo arrancar

```bash
npm install                 # el postinstall copia Leaflet y supabase-js a front/js/vendor/
npm run dev                 # http://localhost:5500
npm test                    # pruebas unitarias (Jest + jsdom)
npm run lint                # ESLint
```

`USAR_API_SIMULADA` está en `apis/config.js`: con `true` la app funciona sin Supabase.
Para usar el backend real, configura `SUPABASE_URL` y `SUPABASE_ANON_KEY` en ese mismo
archivo y cambia el interruptor a `false`. La `service_role` nunca se versiona.

## Contrato y reglas

- `docs/requisitos.md`: CU-01 a CU-08. `docs/diseno.md`: pantallas y estilo.
- `docs/contrato-api.md`: forma de cada función de API, parámetros y errores.
- `docs/decisiones/0001-arquitectura.md`: decisiones aprobadas.
- Solo Angel aplica migraciones, y siempre con confirmación explícita.
