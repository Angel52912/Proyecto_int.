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

  /** La primera pantalla no mueve el foco: el lector ya lee la página al abrirla. */
  let primeraVista = true;
  /** Rutas visitadas, para saber si el cambio es hacia atrás (la animación entra por el otro lado). */
  /** @type {string[]} */
  const historial = [];

  /**
   * Marca en `<html data-navegacion>` si se avanza o se regresa (lo usa layout.css).
   * @param {string} ruta
   */
  function marcarDireccion(ruta) {
    let direccion = "adelante";
    if (historial.length >= 2 && historial[historial.length - 2] === ruta) {
      historial.pop();
      direccion = "atras";
    } else if (historial[historial.length - 1] !== ruta) {
      historial.push(ruta);
    }
    if (historial.length > 50) historial.shift();
    document.documentElement.dataset.navegacion = direccion;
  }

  /**
   * Tras cambiar de pantalla: vuelve arriba y lleva el foco al título (h1) para que el lector
   * de pantalla anuncie la pantalla nueva. Si no hay h1, enfoca el contenedor.
   */
  function prepararVista() {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    if (primeraVista) {
      primeraVista = false;
      return;
    }
    const titulo = /** @type {HTMLElement} */ (contenedor.querySelector("h1") ?? contenedor);
    if (!titulo.hasAttribute("tabindex")) titulo.setAttribute("tabindex", "-1");
    titulo.focus({ preventScroll: true });
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
      marcarDireccion(ruta);
      contenedor.replaceChildren(vista);
      prepararVista();
      // Aviso para quien decora la pantalla ya pintada (contadores de la barra, ui/… y features/…).
      window.dispatchEvent(new CustomEvent("mixanab:pantalla", { detail: { ruta } }));
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
