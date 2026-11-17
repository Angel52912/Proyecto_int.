// Piezas compartidas del panel de administración (CU-08): lista paginada, filtros en chips, confirmación con motivo
// y textos de roles, estados y bitácora. Todo texto libre (nombres, comentarios, motivos) va con textContent.
import { crear } from "../../ui/dom.js";
import { cargarEn, crearVacio } from "../../ui/estados.js";
import { mensajeDeError } from "../../ui/mensajes.js";

/** Filas por página en las listas del panel. */
export const POR_PAGINA = 20;

/** @type {Readonly<Record<string, string>>} */
export const NOMBRE_ROL = Object.freeze({ client: "Cliente", craftsman: "Artesano", admin: "Admin" });

/** Texto de cada acción de la bitácora (`admin_actions.action`). */
export const NOMBRE_ACCION = Object.freeze({
  user_deactivated: "Desactivó un usuario",
  user_reactivated: "Reactivó un usuario",
  workshop_suspended: "Suspendió un taller",
  workshop_reactivated: "Reactivó un taller",
  review_hidden: "Ocultó una reseña",
  review_restored: "Restauró una reseña",
});

/**
 * Texto de "mostrando X de Y".
 * @param {number} mostrados
 * @param {number} total
 * @returns {string}
 */
export function textoConteo(mostrados, total) {
  if (total === 0) return "Sin resultados";
  return mostrados >= total ? `${total} ${total === 1 ? "resultado" : "resultados"}` : `Mostrando ${mostrados} de ${total}`;
}

/**
 * Chips de filtro de una sola opción (radio). Llama a `alCambiar` con el valor elegido.
 * @template T
 * @param {string} etiqueta nombre accesible del grupo
 * @param {{ texto: string, valor: T }[]} opciones
 * @param {T} inicial
 * @param {(valor: T) => void} alCambiar
 * @returns {HTMLElement}
 */
export function crearChipsFiltro(etiqueta, opciones, inicial, alCambiar) {
  const grupo = crear("div", { clase: "chips", attrs: { role: "radiogroup", "aria-label": etiqueta } });
  const chips = opciones.map((opcion) =>
    crear("button", {
      clase: "chip",
      texto: opcion.texto,
      attrs: { type: "button", role: "radio", "aria-checked": String(opcion.valor === inicial) },
      on: {
        click: (evento) => {
          for (const otro of chips) otro.setAttribute("aria-checked", String(otro === evento.currentTarget));
          alCambiar(opcion.valor);
        },
      },
    }),
  );
  grupo.append(...chips);
  return grupo;
}

/**
 * Lista con "Cargar más": pide páginas de `POR_PAGINA` a `cargar(offset)` (que devuelve `{ total, items }` del
 * contrato) y pinta cada fila con `crearFila`. `recargar()` vuelve a la primera página (al cambiar filtros).
 * @template F
 * @param {{ cargar: (offset: number) => Promise<{ total: number, items: F[] }>, crearFila: (item: F) => Node, vacio: string, errores?: Record<string, string> }} opciones
 * @returns {{ elemento: HTMLElement, recargar: () => Promise<void> }}
 */
export function crearListaPaginada({ cargar, crearFila, vacio, errores = {} }) {
  const contenido = crear("div", { attrs: { "aria-live": "polite" } });
  const recargar = () =>
    cargarEn(
      contenido,
      () => cargar(0),
      ({ total, items }) => {
        if (items.length === 0) return crearVacio(vacio);
        const lista = crear("ul", { clase: "lista admin-lista" }, items.map((item) => crear("li", {}, [crearFila(item)])));
        const conteo = crear("p", { clase: "texto-secundario admin-conteo", texto: textoConteo(items.length, total) });
        let mostrados = items.length;
        const aviso = crear("p", { clase: "campo__error", attrs: { "aria-live": "polite" } });
        const mas = /** @type {HTMLButtonElement} */ (
          crear("button", {
            clase: "boton boton--secundario boton--bloque",
            texto: "Cargar más",
            attrs: { type: "button", hidden: mostrados >= total },
            on: {
              click: async () => {
                mas.disabled = true;
                aviso.textContent = "";
                try {
                  const pagina = await cargar(mostrados);
                  lista.append(...pagina.items.map((item) => crear("li", {}, [crearFila(item)])));
                  mostrados += pagina.items.length;
                  conteo.textContent = textoConteo(mostrados, pagina.total);
                  mas.hidden = mostrados >= pagina.total || pagina.items.length === 0;
                } catch (error) {
                  aviso.textContent = mensajeDeError(error, errores);
                } finally {
                  mas.disabled = false;
                }
              },
            },
          })
        );
        return [conteo, lista, aviso, mas];
      },
      errores,
    );
  recargar();
  return { elemento: contenido, recargar };
}

/**
 * Botón de acción que pide confirmación en línea con un motivo opcional (máximo 300, queda en la bitácora).
 * `ejecutar(motivo)` hace la llamada; si falla, el error se muestra junto al botón.
 * @param {{ texto: string, pregunta: string, variante?: "secundario" | "peligro", ejecutar: (motivo: string | undefined) => Promise<void> }} opciones
 * @returns {HTMLElement}
 */
export function crearAccionConMotivo({ texto, pregunta, variante = "secundario", ejecutar }) {
  const contenedor = crear("div", { clase: "admin-accion" });
  const error = crear("p", { clase: "campo__error", attrs: { "aria-live": "polite" } });
  const abrir = crear("button", { clase: `boton-texto${variante === "peligro" ? " boton-texto--peligro" : ""}`, texto, attrs: { type: "button" } });

  const motivo = /** @type {HTMLTextAreaElement} */ (crear("textarea", { attrs: { rows: 2, maxlength: 300, placeholder: "Motivo (opcional, queda en la bitácora)" } }));
  const confirmar = /** @type {HTMLButtonElement} */ (crear("button", { clase: "boton", texto: "Confirmar", attrs: { type: "submit" } }));
  const cancelar = crear("button", { clase: "boton boton--secundario", texto: "Cancelar", attrs: { type: "button" } });
  const formulario = crear(
    "form",
    {
      clase: "admin-confirmacion",
      attrs: { hidden: true },
      on: {
        submit: async (evento) => {
          evento.preventDefault();
          confirmar.disabled = true;
          error.textContent = "";
          try {
            const texto = motivo.value.trim();
            await ejecutar(texto === "" ? undefined : texto);
          } catch (fallo) {
            error.textContent = mensajeDeError(fallo, {
              invalid_state: "Ya tenía ese estado o la acción no aplica. Actualiza la lista.",
              forbidden: "No puedes hacer esta acción.",
            });
          } finally {
            confirmar.disabled = false;
          }
        },
      },
    },
    [crear("p", { clase: "admin-confirmacion__pregunta", texto: pregunta }), crear("label", { clase: "campo" }, [crear("span", { clase: "oculto-visual", texto: "Motivo" }), motivo]), crear("div", { clase: "acciones" }, [cancelar, confirmar])],
  );

  abrir.addEventListener("click", () => {
    formulario.hidden = false;
    abrir.hidden = true;
    motivo.focus();
  });
  cancelar.addEventListener("click", () => {
    formulario.hidden = true;
    abrir.hidden = false;
    motivo.value = "";
    error.textContent = "";
  });
  contenedor.append(abrir, formulario, error);
  return contenedor;
}

/**
 * Campo de búsqueda que avisa con un pequeño retraso al escribir (para no consultar en cada tecla).
 * @param {string} etiqueta
 * @param {(texto: string) => void} alBuscar
 * @returns {HTMLElement}
 */
export function crearBuscadorAdmin(etiqueta, alBuscar) {
  const entrada = /** @type {HTMLInputElement} */ (crear("input", { attrs: { type: "search", maxlength: 100, placeholder: etiqueta, "aria-label": etiqueta } }));
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let espera;
  entrada.addEventListener("input", () => {
    clearTimeout(espera);
    espera = setTimeout(() => alBuscar(entrada.value.trim()), 300);
  });
  return crear("div", { clase: "campo buscador" }, [entrada]);
}
