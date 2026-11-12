/**
 * Router por hash (`#/ruta`). No requiere fallback de servidor.
 *
 * @typedef {object} Contexto
 * @property {Record<string, string>} params Parámetros de la ruta (`/pedido/:id`).
 * @property {URLSearchParams} consulta Parámetros de la query dentro del hash.
 *
 * @typedef {object} Ruta
 * @property {string} path Patrón, por ejemplo `/pedido/:id`.
 * @property {boolean} [requiereSesion] Redirige a la ruta de acceso si no hay sesión.
 * @property {(contexto: Contexto) => Node | Promise<Node>} render
 */

export const RUTA_ACCESO = "/acceso";

/**
 * @param {string} patron
 * @returns {{ expresion: RegExp, claves: string[] }}
 */
export function compilarRuta(patron) {
  /** @type {string[]} */
  const claves = [];
  const fuente = patron
    .split("/")
    .map((segmento) => {
      if (segmento.startsWith(":")) {
        claves.push(segmento.slice(1));
        return "([^/]+)";
      }
      return segmento.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return { expresion: new RegExp(`^${fuente}/?$`), claves };
}

/**
 * Separa `#/ruta?x=1` en ruta y consulta. Un hash vacío equivale a `/`.
 * @param {string} hash
 * @returns {{ ruta: string, consulta: URLSearchParams }}
 */
export function analizarHash(hash) {
  const limpio = hash.replace(/^#/, "");
  const [rutaCruda, ...resto] = limpio.split("?");
  const ruta = rutaCruda === "" ? "/" : rutaCruda.startsWith("/") ? rutaCruda : `/${rutaCruda}`;
  return { ruta, consulta: new URLSearchParams(resto.join("?")) };
}

/**
 * @param {ReadonlyArray<Ruta>} rutas
 * @param {string} ruta
 * @returns {{ ruta: Ruta, params: Record<string, string> } | null}
 */
export function resolverRuta(rutas, ruta) {
  for (const candidata of rutas) {
    const { expresion, claves } = compilarRuta(candidata.path);
    const coincidencia = expresion.exec(ruta);
    if (coincidencia === null) continue;
    /** @type {Record<string, string>} */
    const params = {};
    claves.forEach((clave, indice) => {
      params[clave] = decodeURIComponent(coincidencia[indice + 1]);
    });
    return { ruta: candidata, params };
  }
  return null;
}

/**
 * @param {object} opciones
 * @param {ReadonlyArray<Ruta>} opciones.rutas
 * @param {HTMLElement} opciones.contenedor
 * @param {() => Promise<object | null>} opciones.obtenerSesion
 * @returns {{ iniciar: () => Promise<void>, navegar: (ruta: string) => void }}
 */
export function crearRouter({ rutas, contenedor, obtenerSesion }) {
  /** @param {string} mensaje */
  function mostrarMensaje(mensaje) {
    const parrafo = document.createElement("p");
    parrafo.className = "estado-error";
    parrafo.textContent = mensaje;
    contenedor.replaceChildren(parrafo);
  }

  /** @param {string} ruta */
  function navegar(ruta) {
    window.location.hash = `#${ruta}`;
  }

  async function resolver() {
    const { ruta, consulta } = analizarHash(window.location.hash);
    const encontrada = resolverRuta(rutas, ruta);
    if (encontrada === null) {
      mostrarMensaje("No encontramos esa página.");
      return;
    }
    try {
      if (encontrada.ruta.requiereSesion === true && (await obtenerSesion()) === null) {
        navegar(RUTA_ACCESO);
        return;
      }
      const vista = await encontrada.ruta.render({ params: encontrada.params, consulta });
      contenedor.replaceChildren(vista);
    } catch {
      mostrarMensaje("Algo salió mal. Intenta de nuevo.");
    }
  }

  async function iniciar() {
    window.addEventListener("hashchange", resolver);
    await resolver();
  }

  return { iniciar, navegar };
}
