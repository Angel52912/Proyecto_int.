// Versión del caché del service worker calculada a partir del contenido de la interfaz.
// Uso: `npm run cache:version` reescribe CACHE_VERSION en sw.js. La prueba sw-version.test.js
// falla si alguien cambia la interfaz y olvida correrlo, o si un archivo de front/ no está en INTERFAZ.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const RAIZ = fileURLToPath(new URL("../../", import.meta.url));
const SW = join(RAIZ, "sw.js");
const PATRON_VERSION = /const CACHE_VERSION = "([^"]*)";/;
/** Dependencias copiadas a front/js/vendor: entra su versión (no su contenido, que se genera al instalar). */
const DEPENDENCIAS = ["leaflet", "@supabase/supabase-js", "qrcode-generator"];
const BINARIO = /\.(png|jpe?g|webp|ico|woff2?|ttf)$/i;

/** @returns {string[]} rutas de INTERFAZ en sw.js, sin "./" (la raíz se omite: es index.html). */
export function rutasInterfaz(texto = readFileSync(SW, "utf8")) {
  const bloque = texto.split("const INTERFAZ = [")[1]?.split("];")[0] ?? "";
  return [...bloque.matchAll(/"\.\/([^"]*)"/g)].map((m) => m[1]).filter((ruta) => ruta !== "");
}

/** @returns {string} versión actual escrita en sw.js */
export function versionEscrita(texto = readFileSync(SW, "utf8")) {
  return PATRON_VERSION.exec(texto)?.[1] ?? "";
}

/** @returns {string} `mixanab-ui-` + 10 caracteres del sha256 de la interfaz. */
export function calcularVersion() {
  const hash = createHash("sha256");
  for (const ruta of rutasInterfaz()) {
    if (ruta.startsWith("front/js/vendor/")) continue;
    let contenido = readFileSync(join(RAIZ, ruta));
    // Texto con saltos de línea normalizados: Git en Windows puede dejar CRLF y en Mac/Linux LF,
    // y la versión debe salir igual para todo el equipo.
    if (!BINARIO.test(ruta)) contenido = Buffer.from(contenido.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
    hash.update(ruta).update("\0").update(contenido).update("\0");
  }
  const bloqueo = JSON.parse(readFileSync(join(RAIZ, "package-lock.json"), "utf8"));
  for (const dep of DEPENDENCIAS) hash.update(`${dep}@${bloqueo.packages?.[`node_modules/${dep}`]?.version ?? "?"}\0`);
  return `mixanab-ui-${hash.digest("hex").slice(0, 10)}`;
}

/** @returns {string[]} archivos de front/ (js, css, fuentes, íconos) y módulos de apis/ que faltan en INTERFAZ. */
export function archivosFaltantes() {
  const listados = new Set(rutasInterfaz());
  /** @type {string[]} */
  const encontrados = [];
  const recorrer = (/** @type {string} */ carpeta) => {
    for (const nombre of readdirSync(carpeta)) {
      const ruta = join(carpeta, nombre);
      if (statSync(ruta).isDirectory()) {
        if (nombre !== "vendor") recorrer(ruta);
      } else {
        encontrados.push(relative(RAIZ, ruta).split(sep).join("/"));
      }
    }
  };
  for (const carpeta of ["front/js", "front/css", "front/fonts", "front/icons", "apis"]) {
    if (existsSync(join(RAIZ, carpeta))) recorrer(join(RAIZ, carpeta));
  }
  // De apis/ solo cuentan los módulos (.js): ahí también hay README y otros documentos.
  return encontrados.filter((ruta) => !listados.has(ruta) && (!ruta.startsWith("apis/") || ruta.endsWith(".js")));
}

// Ejecutado directamente: escribe la versión en sw.js.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const faltan = archivosFaltantes();
  if (faltan.length > 0) {
    console.error(`Agrega a INTERFAZ en sw.js:\n  ${faltan.join("\n  ")}`);
    process.exit(1);
  }
  const texto = readFileSync(SW, "utf8");
  const nueva = calcularVersion();
  if (versionEscrita(texto) === nueva) {
    console.log(`CACHE_VERSION ya está al día: ${nueva}`);
  } else {
    writeFileSync(SW, texto.replace(PATRON_VERSION, `const CACHE_VERSION = "${nueva}";`));
    console.log(`CACHE_VERSION → ${nueva}`);
  }
}
