// 03 · Verificación (CU-01): código de 6 dígitos y reenvío con cuenta regresiva (A2).
import { USAR_API_SIMULADA } from "../../../../../apis/config.js";
import { LONGITUD_CODIGO } from "../../../../../apis/lib/validate.js";
import { alSalir } from "../../../ui/ciclo.js";
import { crear, ir } from "../../../ui/dom.js";
import { icono } from "../../../ui/iconos.js";
import { crearBoton, crearPantalla } from "../../../ui/layout.js";
import { mensajeDeError } from "../../../ui/mensajes.js";
import { continuarTrasEntrar, datosAcceso } from "../flujo.js";
import { crearPasosRegistro } from "./bienvenida.js";
import { api } from "../index.js";

/** Segundos de espera antes de poder pedir otro código. */
export const ESPERA_REENVIO = 60;

/**
 * "0:42" a partir de segundos.
 * @param {number} segundos
 * @returns {string}
 */
export function formatoCuenta(segundos) {
  const s = Math.max(0, Math.floor(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Reparte un texto pegado en las casillas: solo dígitos, como máximo los que caben desde `inicio`.
 * @param {string} texto
 * @param {number} [inicio]
 * @returns {string[]}
 */
export function repartirCodigo(texto, inicio = 0) {
  return texto.replace(/\D/g, "").slice(0, LONGITUD_CODIGO - inicio).split("");
}

/** @returns {Node} */
export function renderCodigo() {
  const { correo } = datosAcceso();
  if (correo === "") {
    ir("/acceso/entrar");
    return crear("p", { clase: "estado-cargando", texto: "Cargando…" });
  }

  // El error va justo debajo de las casillas: abajo, junto a Confirmar, lo tapaba el teclado del celular y parecía
  // que el código "solo se borraba" (reporte de Milton).
  const aviso = crear("p", { clase: "acceso__error-codigo", attrs: { role: "alert" } });
  /** @param {string} texto */
  const mostrarError = (texto) => {
    aviso.replaceChildren(icono("cerrar", { tam: 16 }), crear("span", { texto }));
    grupo.classList.remove("codigo--sacudir");
    // Se fuerza el reinicio de la animación para que se sacuda también en el segundo intento.
    void grupo.offsetWidth;
    grupo.classList.add("codigo--error", "codigo--sacudir");
  };
  const limpiarError = () => {
    aviso.replaceChildren();
    grupo.classList.remove("codigo--error");
  };
  const casillas = Array.from({ length: LONGITUD_CODIGO }, (_, indice) =>
    /** @type {HTMLInputElement} */ (
      crear("input", {
        attrs: {
          type: "text",
          inputmode: "numeric",
          autocomplete: indice === 0 ? "one-time-code" : "off",
          maxlength: indice === 0 ? LONGITUD_CODIGO : 1,
          "aria-label": `Dígito ${indice + 1} de ${LONGITUD_CODIGO}`,
        },
      })
    ),
  );
  const grupo = crear("fieldset", { clase: "codigo" }, [crear("legend", { clase: "oculto-visual", texto: "Código de verificación" }), ...casillas]);

  /** @param {number} desde @param {string} texto */
  const rellenar = (desde, texto) => {
    const digitos = repartirCodigo(texto, desde);
    digitos.forEach((d, i) => {
      casillas[desde + i].value = d;
    });
    casillas[Math.min(desde + digitos.length, LONGITUD_CODIGO - 1)].focus();
  };

  casillas.forEach((casilla, indice) => {
    casilla.addEventListener("input", () => {
      limpiarError();
      const valor = casilla.value;
      casilla.value = "";
      if (valor.replace(/\D/g, "") === "") return;
      rellenar(indice, valor);
    });
    casilla.addEventListener("keydown", (evento) => {
      if (evento.key === "Backspace" && casilla.value === "" && indice > 0) {
        casillas[indice - 1].value = "";
        casillas[indice - 1].focus();
        evento.preventDefault();
      }
    });
    casilla.addEventListener("paste", (evento) => {
      evento.preventDefault();
      rellenar(indice, evento.clipboardData?.getData("text") ?? "");
    });
  });

  const confirmar = crearBoton("Confirmar", { tipo: "submit" });

  // A2: reenvío con cuenta regresiva.
  const reenvio = crear("p", { clase: "acceso__reenviar", attrs: { "aria-live": "polite" } });
  let restante = ESPERA_REENVIO;
  /** @type {ReturnType<typeof setInterval> | null} */
  let reloj = null;
  const pintarReenvio = () => {
    if (restante > 0) {
      reenvio.replaceChildren(`¿No te llegó? Reenviar en ${formatoCuenta(restante)}`);
      return;
    }
    const boton = crear("button", {
      clase: "boton-texto",
      texto: "Reenviar código",
      attrs: { type: "button" },
      on: {
        click: async () => {
          /** @type {HTMLButtonElement} */ (boton).disabled = true;
          limpiarError();
          try {
            await api.resendEmailCode(correo);
            // La cuenta regresiva vuelve a empezar: es la señal de que el código nuevo salió.
            iniciarCuenta();
          } catch (error) {
            mostrarError(mensajeDeError(error));
            /** @type {HTMLButtonElement} */ (boton).disabled = false;
          }
        },
      },
    });
    reenvio.replaceChildren("¿No te llegó? ", boton);
  };
  const iniciarCuenta = () => {
    restante = ESPERA_REENVIO;
    if (reloj !== null) clearInterval(reloj);
    reloj = setInterval(() => {
      restante -= 1;
      pintarReenvio();
      if (restante <= 0 && reloj !== null) clearInterval(reloj);
    }, 1000);
    pintarReenvio();
  };
  iniciarCuenta();
  alSalir(() => {
    if (reloj !== null) clearInterval(reloj);
  });

  const formulario = crear(
    "form",
    {
      clase: "acceso__formulario",
      attrs: { novalidate: true },
      on: {
        submit: async (evento) => {
          evento.preventDefault();
          const codigo = casillas.map((c) => c.value).join("");
          if (codigo.length !== LONGITUD_CODIGO) {
            mostrarError(`Escribe los ${LONGITUD_CODIGO} dígitos del código.`);
            casillas.find((c) => c.value === "")?.focus();
            return;
          }
          confirmar.disabled = true;
          limpiarError();
          try {
            await api.verifyEmailCode(correo, codigo);
            await continuarTrasEntrar();
          } catch (error) {
            mostrarError(mensajeDeError(error, { invalid_code: "El código no es correcto o ya venció. Revísalo o pide uno nuevo." }));
            casillas.forEach((c) => {
              c.value = "";
            });
            casillas[0].focus();
            confirmar.disabled = false;
          }
        },
      },
    },
    [
      // Solo en el registro (el nombre se captura al crear la cuenta); al iniciar sesión no hay más pasos.
      datosAcceso().nombre !== "" ? crearPasosRegistro(2) : null,
      crear("span", { clase: "acceso__icono", attrs: { "aria-hidden": "true" } }, [icono("correo", { tam: 30 })]),
      crear("h2", { clase: "acceso__titulo", texto: "Revisa tu correo" }),
      crear("p", { clase: "acceso__texto" }, [`Escribe el código de ${LONGITUD_CODIGO} dígitos que enviamos a `, crear("span", { clase: "acceso__correo", texto: correo }), "."]),
      USAR_API_SIMULADA ? crear("p", { clase: "aviso aviso--miel aviso--simulado", texto: "Modo simulado: el código es 123456." }) : null,
      grupo,
      aviso,
      reenvio,
      crear("div", { clase: "acceso__pie" }, [confirmar]),
    ],
  );

  return crearPantalla({ titulo: "Verificación", volver: "/acceso/entrar", clase: "acceso" }, [formulario]);
}
