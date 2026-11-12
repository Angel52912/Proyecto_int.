// Copia las librerías de navegador a js/vendor/ (sin CDN, para que la PWA no dependa de terceros).
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const destino = join(raiz, "js", "vendor");

/** @type {ReadonlyArray<{ origen: string, nombre: string }>} */
const archivos = [
  { origen: "node_modules/@supabase/supabase-js/dist/umd/supabase.js", nombre: "supabase.js" },
  { origen: "node_modules/leaflet/dist/leaflet.js", nombre: "leaflet.js" },
  { origen: "node_modules/leaflet/dist/leaflet.css", nombre: "leaflet.css" },
  { origen: "node_modules/leaflet/dist/images", nombre: "images" },
];

mkdirSync(destino, { recursive: true });

let faltantes = 0;
for (const { origen, nombre } of archivos) {
  const ruta = join(raiz, origen);
  if (!existsSync(ruta)) {
    console.error(`vendor: no existe ${origen}`);
    faltantes += 1;
    continue;
  }
  cpSync(ruta, join(destino, nombre), { recursive: true });
}

if (faltantes > 0) process.exit(1);
console.log(`vendor: ${archivos.length} elementos copiados a js/vendor/`);
