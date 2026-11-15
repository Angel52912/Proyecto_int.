// Perfil del cliente (pestaña Perfil de la navegación inferior): nombre, datos privados y cerrar sesión.
// La captura y edición del perfil es la pantalla 05 · Datos del cliente (CU-01, Acceso).
import { USAR_API_SIMULADA } from "../../../config.js";
import { crear, enlace, ir } from "../../../ui/dom.js";
import { cargarEn } from "../../../ui/estados.js";
import { crearBoton, crearPantalla, iniciales } from "../../../ui/layout.js";
import { api } from "../index.js";

/** @param {{ perfil: any, privados: any | null }} datos */
function pintar({ perfil, privados }) {
  const salir = crearBoton("Cerrar sesión", {
    variante: "secundario",
    alHacerClic: async () => {
      try {
        await api.signOut();
      } finally {
        ir("/");
      }
    },
  });
  return [
    crear("div", { clase: "tarjeta tarjeta--enlace" }, [
      crear("span", { clase: "avatar", texto: iniciales(perfil.full_name), attrs: { "aria-hidden": "true" } }),
      crear("div", { clase: "tarjeta__cuerpo" }, [crear("p", { clase: "tarjeta__titulo", texto: perfil.full_name || "Sin nombre" }), crear("p", { clase: "tarjeta__detalle", texto: "Cliente" })]),
    ]),
    crear("dl", { clase: "tarjeta horario" }, [
      crear("dt", { texto: "Edad" }),
      crear("dd", { texto: privados?.age ? `${privados.age} años` : "Sin capturar" }),
      crear("dt", { texto: "Dirección" }),
      crear("dd", { texto: privados?.address ?? "Sin capturar" }),
    ]),
    salir,
  ];
}

/** @returns {Promise<Node>} */
export async function renderPerfilCliente() {
  const contenido = crear("div", { clase: "seguimiento__contenido" });
  const pantalla = crearPantalla({ rol: "client", activa: "perfil", clase: "perfil-cliente" }, [
    crear("h1", { clase: "pantalla__titulo", texto: "Mi perfil" }),
    contenido,
    USAR_API_SIMULADA ? enlace("/simulacion", { clase: "boton-texto", texto: "Cambiar de rol (modo simulado)" }) : null,
  ]);
  cargarEn(
    contenido,
    async () => {
      const perfil = await api.getMyProfile();
      return { perfil, privados: await api.getMyClientPrivate().catch(() => null) };
    },
    pintar,
  ).then(() => {
    // Sin sesión de Supabase (p. ej. en el simulado sin pasar por Acceso) se ofrece ir a iniciar sesión.
    if (contenido.querySelector(".estado-error")) {
      contenido.append(enlace("/", { clase: "boton boton--bloque", texto: "Iniciar sesión" }));
    }
  });
  return pantalla;
}
