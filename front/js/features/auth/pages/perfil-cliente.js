// Perfil del cliente (pestaña Perfil de la navegación inferior): nombre, foto, datos privados y cerrar sesión.
// La edición usa la pantalla 05 · Completar perfil (CU-01) con `?desde=perfil`.
import { USAR_API_SIMULADA } from "../../../../../apis/config.js";
import { crear, enlace } from "../../../ui/dom.js";
import { cargarEn } from "../../../ui/estados.js";
import { crearBoton, crearPantalla } from "../../../ui/layout.js";
import { crearAvatar } from "../avatar.js";
import { cerrarSesion } from "../flujo.js";
import { api } from "../index.js";

/** @param {{ perfil: any, privados: any | null }} datos */
function pintar({ perfil, privados }) {
  const salir = crearBoton("Cerrar sesión", { variante: "secundario", alHacerClic: () => cerrarSesion() });
  return [
    crear("div", { clase: "tarjeta tarjeta--enlace" }, [
      crearAvatar({ nombre: perfil.full_name, avatarPath: perfil.avatar_path }),
      crear("div", { clase: "tarjeta__cuerpo" }, [crear("p", { clase: "tarjeta__titulo", texto: perfil.full_name || "Sin nombre" }), crear("p", { clase: "tarjeta__detalle", texto: "Cliente" })]),
    ]),
    crear("dl", { clase: "tarjeta horario" }, [
      crear("dt", { texto: "Edad" }),
      crear("dd", { texto: privados?.age ? `${privados.age} años` : "Sin capturar" }),
      crear("dt", { texto: "Dirección" }),
      crear("dd", { texto: privados?.address ?? "Sin capturar" }),
    ]),
    enlace("/acceso/perfil?desde=perfil", { clase: "boton boton--bloque", texto: "Editar perfil" }),
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
    // Sin sesión (p. ej. en el simulado sin pasar por Acceso) se ofrece ir a iniciar sesión.
    if (contenido.querySelector(".estado-error")) {
      contenido.append(enlace("/acceso", { clase: "boton boton--bloque", texto: "Iniciar sesión" }));
    }
  });
  return pantalla;
}
