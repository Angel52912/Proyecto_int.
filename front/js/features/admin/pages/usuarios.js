// Admin · Usuarios (CU-08): listar, buscar por nombre o correo, filtrar por rol, desactivar y reactivar (no se eliminan).
// A1: el admin no puede desactivarse a sí mismo y siempre queda al menos un admin activo (lo valida el servidor).
import { formatearFecha } from "../../../lib/fechas.js";
import { crear } from "../../../ui/dom.js";
import { crearInsignia, crearPantalla, iniciales } from "../../../ui/layout.js";
import { NOMBRE_ROL, POR_PAGINA, crearAccionConMotivo, crearBuscadorAdmin, crearChipsFiltro, crearListaPaginada } from "../componentes.js";
import { api } from "../index.js";

/** @typedef {{ id: string, role: string | null, full_name: string, email: string, active: boolean, created_at: string }} UsuarioAdmin */

/**
 * @param {UsuarioAdmin} usuario
 * @param {() => void} alCambiar
 */
function crearFila(usuario, alCambiar) {
  const nombre = usuario.full_name || "Sin nombre";
  return crear("div", { clase: "tarjeta admin-fila" }, [
    crear("div", { clase: "admin-fila__cabecera" }, [
      crear("span", { clase: "avatar", texto: iniciales(nombre), attrs: { "aria-hidden": "true" } }),
      crear("div", { clase: "tarjeta__cuerpo" }, [crear("p", { clase: "tarjeta__titulo", texto: nombre }), crear("p", { clase: "tarjeta__detalle admin-fila__correo", texto: usuario.email })]),
    ]),
    crear("div", { clase: "chips chips--envolver-izq" }, [
      crearInsignia(usuario.role ? NOMBRE_ROL[usuario.role] ?? usuario.role : "Sin rol", usuario.role === "admin" ? "cenote" : "neutra"),
      crearInsignia(usuario.active ? "Activo" : "Desactivado", usuario.active ? "exito" : "error"),
      crear("span", { clase: "texto-secundario", texto: `Alta: ${formatearFecha(usuario.created_at)}` }),
    ]),
    crearAccionConMotivo({
      texto: usuario.active ? "Desactivar" : "Reactivar",
      variante: usuario.active ? "peligro" : "secundario",
      pregunta: usuario.active ? `¿Desactivar a ${nombre}? No podrá usar la app hasta que lo reactives.` : `¿Reactivar a ${nombre}?`,
      ejecutar: async (motivo) => {
        await api.setUserActive(usuario.id, !usuario.active, motivo);
        alCambiar();
      },
    }),
  ]);
}

/** @returns {Node} */
export function renderUsuarios() {
  /** @type {{ search: string, role: string, active: string }} */
  const filtros = { search: "", role: "", active: "" };
  const lista = crearListaPaginada({
    cargar: (offset) =>
      api.listUsers({
        ...(filtros.search ? { search: filtros.search } : {}),
        ...(filtros.role ? { role: filtros.role } : {}),
        ...(filtros.active ? { active: filtros.active === "si" } : {}),
        limit: POR_PAGINA,
        offset,
      }),
    crearFila: (u) => crearFila(/** @type {UsuarioAdmin} */ (u), () => lista.recargar()),
    vacio: "No hay usuarios con esos filtros.",
  });

  return crearPantalla({ rol: "admin", activa: "usuarios", clase: "admin" }, [
    crear("h1", { clase: "pantalla__titulo", texto: "Usuarios" }),
    crearBuscadorAdmin("Buscar por nombre o correo", (texto) => {
      filtros.search = texto;
      lista.recargar();
    }),
    crearChipsFiltro(
      "Rol",
      [
        { texto: "Todos", valor: "" },
        { texto: "Clientes", valor: "client" },
        { texto: "Artesanos", valor: "craftsman" },
        { texto: "Admins", valor: "admin" },
      ],
      "",
      (valor) => {
        filtros.role = valor;
        lista.recargar();
      },
    ),
    crearChipsFiltro(
      "Estado",
      [
        { texto: "Cualquier estado", valor: "" },
        { texto: "Activos", valor: "si" },
        { texto: "Desactivados", valor: "no" },
      ],
      "",
      (valor) => {
        filtros.active = valor;
        lista.recargar();
      },
    ),
    lista.elemento,
  ]);
}
