// Ventana de confirmación con los colores de la app (claro y oscuro), en lugar de la del navegador (window.confirm),
// que no se puede estilizar. Se cierra con Cancelar, con Esc o tocando fuera; devuelve true solo con el botón de aceptar.
import { crear } from "./dom.js";

let contador = 0;

/**
 * @param {{ titulo: string, mensaje: string, aceptar?: string, cancelar?: string, peligro?: boolean }} opciones
 *   `peligro`: la acción no se puede deshacer (cancelar una solicitud, rechazar): el botón va en rojo.
 * @returns {Promise<boolean>}
 */
export function confirmar({ titulo, mensaje, aceptar = "Aceptar", cancelar = "Cancelar", peligro = false }) {
  // Sin <dialog> (navegadores muy viejos o las pruebas con jsdom): la confirmación del navegador.
  if (typeof globalThis.HTMLDialogElement?.prototype?.showModal !== "function") return Promise.resolve(window.confirm(`${titulo}\n\n${mensaje}`));

  contador += 1;
  const idTitulo = `confirmar-titulo-${contador}`;
  const idMensaje = `confirmar-mensaje-${contador}`;
  return new Promise((resolver) => {
    const botonCancelar = crear("button", { clase: "boton boton--secundario", texto: cancelar, attrs: { type: "button" } });
    const botonAceptar = crear("button", { clase: `boton${peligro ? " boton--peligro" : ""}`, texto: aceptar, attrs: { type: "button" } });
    const dialogo = /** @type {HTMLDialogElement} */ (
      crear("dialog", { clase: "confirmar", attrs: { "aria-labelledby": idTitulo, "aria-describedby": idMensaje } }, [
        crear("h2", { clase: "confirmar__titulo", texto: titulo, attrs: { id: idTitulo } }),
        crear("p", { clase: "confirmar__mensaje", texto: mensaje, attrs: { id: idMensaje } }),
        crear("div", { clase: "confirmar__acciones" }, [botonCancelar, botonAceptar]),
      ])
    );

    let resuelto = false;
    /** @param {boolean} valor */
    const cerrar = (valor) => {
      if (resuelto) return;
      resuelto = true;
      if (dialogo.open) dialogo.close();
      dialogo.remove();
      resolver(valor);
    };
    botonCancelar.addEventListener("click", () => cerrar(false));
    botonAceptar.addEventListener("click", () => cerrar(true));
    // Esc y tocar fuera (el fondo oscuro) cuentan como Cancelar.
    dialogo.addEventListener("cancel", (evento) => {
      evento.preventDefault();
      cerrar(false);
    });
    dialogo.addEventListener("click", (evento) => {
      if (evento.target === dialogo) cerrar(false);
    });

    document.body.append(dialogo);
    dialogo.showModal();
    // En las acciones de peligro el foco empieza en Cancelar, para no confirmar por accidente con Enter.
    (peligro ? botonCancelar : botonAceptar).focus();
  });
}
