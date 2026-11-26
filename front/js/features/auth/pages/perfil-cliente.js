// Perfil del cliente (pestaña Perfil de la navegación inferior): nombre, foto, datos privados, accesos y cerrar sesión.
// La edición usa la pantalla 05 · Completar perfil (CU-01) con `?desde=perfil`.
import { crear, enlace } from "../../../ui/dom.js";
import { cargarEn, crearVacio } from "../../../ui/estados.js";
import { icono } from "../../../ui/iconos.js";
import { crearInsignia, crearPantalla } from "../../../ui/layout.js";
import { crearAvatar } from "../avatar.js";
import { cerrarSesion } from "../flujo.js";
import { api } from "../index.js";
import { crearSelectorTema } from "../../../ui/tema.js";

/**
 * Fila de dato con ícono ("Edad · 28 años").
 * @param {string} nombreIcono
 * @param {string} etiqueta
 * @param {string | null | undefined} valor
 */
function crearDato(nombreIcono, etiqueta, valor) {
  return crear("li", { clase: "perfil-dato" }, [
    crear("span", { clase: "perfil-dato__icono", attrs: { "aria-hidden": "true" } }, [icono(nombreIcono, { tam: 18 })]),
    crear("div", { clase: "perfil-dato__texto" }, [
      crear("p", { clase: "perfil-dato__etiqueta", texto: etiqueta }),
      crear("p", { clase: `perfil-dato__valor${valor ? "" : " perfil-dato__valor--vacio"}`, texto: valor || "Sin capturar" }),
    ]),
  ]);
}

/**
 * Opción del menú que lleva a otra pantalla.
 * @param {string} ruta
 * @param {string} nombreIcono
 * @param {string} texto
 */
function crearOpcion(ruta, nombreIcono, texto) {
  return crear("li", {}, [
    enlace(ruta, { clase: "perfil-opcion" }, [
      crear("span", { clase: "perfil-dato__icono", attrs: { "aria-hidden": "true" } }, [icono(nombreIcono, { tam: 18 })]),
      crear("span", { clase: "perfil-opcion__texto", texto }),
      icono("adelante", { tam: 18, clase: "tarjeta__flecha" }),
    ]),
  ]);
}

/** @param {{ perfil: any, privados: any | null } | null} datos `null` = sin sesión. */
function pintar(datos) {
  if (datos === null) {
    return crearVacio("Inicia sesión para ver tu perfil, tus pedidos y tus avisos.", enlace("/acceso", { clase: "boton", texto: "Iniciar sesión" }), { icono: "perfil" });
  }
  const { perfil, privados } = datos;
  return [
    crear("section", { clase: "perfil-encabezado" }, [
      crearAvatar({ nombre: perfil.full_name, avatarPath: perfil.avatar_path, clase: "perfil-encabezado__avatar" }),
      crear("h2", { clase: "perfil-encabezado__nombre", texto: perfil.full_name || "Sin nombre" }),
      crearInsignia("Cliente", "cuero"),
      enlace("/acceso/perfil?desde=perfil", { clase: "boton boton--secundario perfil-encabezado__editar" }, [icono("ajustes", { tam: 16 }), crear("span", { texto: "Editar perfil" })]),
    ]),
    crear("section", { clase: "perfil-seccion", attrs: { "aria-labelledby": "perfil-mis-datos" } }, [
      crear("h2", { clase: "perfil-seccion__titulo", texto: "Mis datos", attrs: { id: "perfil-mis-datos" } }),
      crear("ul", { clase: "perfil-lista" }, [
        crearDato("calendario", "Edad", privados?.age ? `${privados.age} años` : null),
        crearDato("mapa", "Dirección", privados?.address),
      ]),
      crear("p", { clase: "perfil-seccion__nota" }, [icono("escudo", { tam: 14 }), crear("span", { texto: "Solo tú ves estos datos; los talleres no." })]),
    ]),
    crear("section", { clase: "perfil-seccion", attrs: { "aria-labelledby": "perfil-accesos" } }, [
      crear("h2", { clase: "perfil-seccion__titulo", texto: "Mi actividad", attrs: { id: "perfil-accesos" } }),
      crear("ul", { clase: "perfil-lista" }, [crearOpcion("/pedidos", "pedidos", "Mis pedidos"), crearOpcion("/avisos", "campana", "Avisos")]),
    ]),
    crearSelectorTema(),
    crear("button", { clase: "perfil-salir", attrs: { type: "button" }, on: { click: () => cerrarSesion() } }, [crear("span", { texto: "Cerrar sesión" })]),
  ];
}

/** @returns {Promise<Node>} */
export async function renderPerfilCliente() {
  const contenido = crear("div", { clase: "perfil-cliente__contenido" });
  const pantalla = crearPantalla({ rol: "client", activa: "perfil", clase: "perfil-cliente" }, [
    crear("h1", { clase: "pantalla__titulo", texto: "Mi perfil" }),
    contenido,
  ]);
  cargarEn(contenido, async () => {
    try {
      const perfil = await api.getMyProfile();
      return { perfil, privados: await api.getMyClientPrivate().catch(() => null) };
    } catch (error) {
      // Sin sesión: un solo llamado a iniciar sesión, en lugar de error + Reintentar + Iniciar sesión.
      if (/** @type {{ code?: string }} */ (error).code === "not_authenticated") return null;
      throw error;
    }
  }, pintar);
  return pantalla;
}
