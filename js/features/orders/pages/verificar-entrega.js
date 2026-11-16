// 22 · Verificar entrega (Artesano, CU-06): escanear el QR del cliente o ingresar el PIN de 6 dígitos.
// 5 intentos y bloqueo de 15 minutos; un PIN incorrecto no lanza error, la api devuelve el resultado.
import { formatearHora } from "../../../lib/fechas.js";
import { alSalir } from "../../../ui/ciclo.js";
import { crear, enlace } from "../../../ui/dom.js";
import { cargarEn } from "../../../ui/estados.js";
import { icono } from "../../../ui/iconos.js";
import { crearBoton, crearPantalla } from "../../../ui/layout.js";
import { mensajeDeError } from "../../../ui/mensajes.js";
import { api } from "../index.js";

/**
 * Mensaje para el resultado de verifyDeliveryPin.
 * @param {{ ok: boolean, attempts_left: number, locked_until: string | null }} resultado
 * @returns {string}
 */
export function mensajeResultadoPin(resultado) {
  if (resultado.ok) return "Entrega confirmada.";
  if (resultado.locked_until) return `Demasiados intentos. Podrás intentar de nuevo a las ${formatearHora(resultado.locked_until)}.`;
  return resultado.attempts_left === 1 ? "PIN incorrecto. Te queda 1 intento." : `PIN incorrecto. Te quedan ${resultado.attempts_left} intentos.`;
}

/** @returns {boolean} */
function puedeEscanear() {
  return "BarcodeDetector" in globalThis && typeof navigator.mediaDevices?.getUserMedia === "function";
}

/** @param {any} pedido */
function pintar(pedido) {
  const raiz = crear("div", { clase: "verificar__contenido" });
  if (pedido.status === "delivered") {
    raiz.append(crearExito());
    return raiz;
  }
  if (pedido.status !== "ready") {
    raiz.append(
      crear("p", { clase: "verificar__aviso", texto: "Este pedido aún no está listo para entrega." }),
      enlace(`/artesano/pedido/${pedido.id}`, { clase: "boton boton--miel boton--bloque", texto: "Ir al pedido" }),
    );
    return raiz;
  }

  const pin = /** @type {HTMLInputElement} */ (
    crear("input", {
      clase: "verificar__pin",
      attrs: { id: "pin", type: "text", inputmode: "numeric", autocomplete: "one-time-code", maxlength: 6, pattern: "\\d{6}", placeholder: "••••••", "aria-describedby": "pin-resultado" },
    })
  );
  pin.addEventListener("input", () => {
    pin.value = pin.value.replace(/\D/g, "").slice(0, 6);
  });
  const resultado = crear("p", { clase: "verificar__resultado", attrs: { id: "pin-resultado", "aria-live": "assertive" } });
  const confirmar = crearBoton("Confirmar entrega", { tipo: "submit", variante: "miel", icono: "escudo" });

  /** @param {string} codigo PIN o texto del QR */
  async function verificar(codigo) {
    resultado.textContent = "";
    confirmar.disabled = true;
    try {
      const r = await api.verifyDeliveryPin(pedido.id, codigo);
      if (r.ok) {
        raiz.replaceChildren(crearExito());
        return;
      }
      resultado.textContent = mensajeResultadoPin(r);
      pin.value = "";
    } catch (error) {
      // A1: formato inválido o QR de otro pedido; no cuenta como intento.
      resultado.textContent = mensajeDeError(error, {
        invalid_input: "Código inválido. Debe ser el PIN de 6 dígitos o el QR de este pedido.",
        invalid_state: "El cliente aún no genera su código de entrega.",
      });
    } finally {
      confirmar.disabled = false;
    }
  }

  // Escáner con la cámara (solo si el navegador tiene BarcodeDetector).
  const marco = crear("div", { clase: "verificar__marco" }, [icono("qr", { tam: 56 })]);
  if (puedeEscanear()) {
    marco.append(
      crearBoton("Escanear QR", {
        variante: "secundario",
        bloque: false,
        icono: "camara",
        alHacerClic: () => escanear(marco, (texto) => verificar(texto)),
      }),
    );
  }

  raiz.append(
    marco,
    crear("p", { clase: "verificar__texto", texto: puedeEscanear() ? "Escanea el QR del cliente" : "Pide al cliente su PIN de entrega" }),
    crear("p", { clase: "verificar__separador", texto: "o ingresa el PIN" }),
    crear(
      "form",
      {
        clase: "verificar__formulario",
        on: {
          submit: (evento) => {
            evento.preventDefault();
            if (!/^\d{6}$/.test(pin.value)) {
              resultado.textContent = "Escribe los 6 dígitos del PIN.";
              pin.focus();
              return;
            }
            verificar(pin.value);
          },
        },
      },
      [crear("label", { clase: "oculto-visual", texto: "PIN de entrega", attrs: { for: "pin" } }), pin, resultado, crear("div", { clase: "acciones" }, [confirmar])],
    ),
  );
  return raiz;
}

function crearExito() {
  return crear("div", { clase: "verificar__exito" }, [
    crear("span", { clase: "calificar__check" }, [icono("check", { tam: 32 })]),
    crear("h2", { texto: "Pedido entregado" }),
    crear("p", { texto: "Le pedimos al cliente que califique tu trabajo." }),
    enlace("/artesano/tablero", { clase: "boton boton--miel boton--bloque", texto: "Volver al tablero" }),
  ]);
}

/**
 * Abre la cámara y lee un QR con BarcodeDetector. Se detiene al leer, al tocar Cancelar o al salir de la pantalla.
 * @param {HTMLElement} marco
 * @param {(texto: string) => void} alLeer
 */
async function escanear(marco, alLeer) {
  /** @type {MediaStream | null} */
  let flujo = null;
  let activo = true;
  const video = /** @type {HTMLVideoElement} */ (crear("video", { clase: "verificar__video", attrs: { playsinline: true, muted: true, "aria-label": "Vista de la cámara" } }));
  const detener = () => {
    activo = false;
    flujo?.getTracks().forEach((pista) => pista.stop());
  };
  alSalir(detener);
  const cancelar = crearBoton("Cancelar", { variante: "secundario", bloque: false, alHacerClic: () => {
    detener();
    marco.replaceChildren(icono("qr", { tam: 56 }));
  } });
  try {
    flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
  } catch {
    marco.replaceChildren(icono("qr", { tam: 56 }), crear("p", { clase: "verificar__texto", texto: "No hay acceso a la cámara. Ingresa el PIN." }));
    return;
  }
  video.srcObject = flujo;
  marco.replaceChildren(video, cancelar);
  await video.play().catch(() => {});
  const detector = new /** @type {any} */ (globalThis).BarcodeDetector({ formats: ["qr_code"] });
  const leer = async () => {
    if (!activo) return;
    try {
      const codigos = await detector.detect(video);
      if (codigos.length > 0) {
        detener();
        marco.replaceChildren(icono("qr", { tam: 56 }));
        alLeer(String(codigos[0].rawValue));
        return;
      }
    } catch {
      // Cuadro sin leer: se intenta de nuevo.
    }
    setTimeout(leer, 300);
  };
  leer();
}

/** @param {import("../../../router.js").Contexto} contexto */
export async function renderVerificarEntrega({ params }) {
  const contenido = crear("div");
  const pantalla = crearPantalla({ titulo: "Verificar entrega", volver: `/artesano/pedido/${params.orderId}`, clase: "verificar", oscura: true }, [contenido]);
  cargarEn(contenido, () => api.getOrder(params.orderId), pintar, { not_found: "No encontramos este pedido.", invalid_input: "No encontramos este pedido." });
  return pantalla;
}
