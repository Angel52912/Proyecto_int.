// Pantalla de solicitud de cotización (CU-03).

import { AppShell } from "../../components/shell.js";
import {
  Button,
  Card,
  Chip,
  ImagePlaceholder,
  PageHeader,
  StickyActionBar,
  TextArea,
} from "../../components/ui.js";
import { Icon } from "../../components/icon.js";
import { getWorkshopById, workshops } from "../../mocks/workshops.js";

/** @param {string} ruta */
function irA(ruta) {
  window.location.hash = `#${ruta}`;
}

const MAX_FOTOS = 5;

/**
 * Formulario para pedir una cotización a un taller.
 * @param {{ params?: Record<string, string> }} [contexto]
 * @returns {HTMLElement}
 */
export function QuoteRequestScreen({ params } = {}) {
  const taller = getWorkshopById(params?.tallerId ?? "") ?? workshops[0];

  /** @type {{ photos: string[], serviceType: "reparacion" | "limpieza", description: string }} */
  const estado = {
    // Dos placeholders del diseño; "" se dibuja como imagen vacía.
    photos: ["", ""],
    serviceType: "reparacion",
    description: "",
  };

  const contenido = document.createElement("div");
  contenido.className = "cotizar";
  const shell = AppShell({
    activeNav: "mapa",
    hideNavOnMobile: true,
    children: contenido,
  });

  function crearTaller() {
    const tarjeta = Card({ padding: 12 });
    tarjeta.classList.add("cotizar__taller");

    const textos = document.createElement("span");
    textos.className = "cotizar__taller-textos";

    const para = document.createElement("span");
    para.className = "cotizar__taller-para";
    para.textContent = "Para";

    const nombre = document.createElement("span");
    nombre.className = "cotizar__taller-nombre";
    nombre.textContent = taller.name;

    textos.append(para, nombre);
    tarjeta.append(
      ImagePlaceholder({ alt: taller.name, width: 36, height: 36 }),
      textos
    );
    return tarjeta;
  }

  function crearFotos() {
    const bloque = document.createElement("section");
    bloque.className = "cotizar__bloque";
    bloque.classList.add("cotizar__bloque--fotos");

    const etiqueta = document.createElement("h2");
    etiqueta.className = "cotizar__etiqueta";
    etiqueta.textContent = "Fotos del calzado";

    const grid = document.createElement("div");
    grid.className = "cotizar__fotos";

    estado.photos.forEach((foto, indice) => {
      const imagen = ImagePlaceholder({
        src: foto === "" ? undefined : foto,
        alt: `Foto del calzado ${indice + 1}`,
      });
      imagen.classList.add("cotizar__foto");
      grid.appendChild(imagen);
    });

    const entrada = document.createElement("input");
    entrada.type = "file";
    entrada.accept = "image/*";
    entrada.multiple = true;
    entrada.hidden = true;
    entrada.addEventListener("change", () => {
      const archivos = Array.from(entrada.files ?? []).slice(0, MAX_FOTOS - estado.photos.length);
      for (const archivo of archivos) estado.photos.push(URL.createObjectURL(archivo));
      pintar();
    });

    if (estado.photos.length < MAX_FOTOS) {
      const agregar = document.createElement("button");
      agregar.type = "button";
      agregar.className = "cotizar__agregar";
      agregar.setAttribute("aria-label", "Agregar fotos del calzado");
      agregar.append(
        Icon({ name: "camera", size: 22 }),
        document.createTextNode("Agregar")
      );
      agregar.addEventListener("click", () => entrada.click());
      grid.appendChild(agregar);
    }

    grid.appendChild(entrada);
    bloque.append(etiqueta, grid);
    return bloque;
  }

  function crearServicio() {
    const bloque = document.createElement("section");
    bloque.className = "cotizar__bloque";

    const etiqueta = document.createElement("h2");
    etiqueta.className = "cotizar__etiqueta";
    etiqueta.textContent = "Tipo de servicio";

    const fila = document.createElement("div");
    fila.className = "cotizar__servicios";
    fila.append(
      Chip({
        variant: "filter",
        active: estado.serviceType === "reparacion",
        leftIcon: Icon({ name: "wrench", size: 16 }),
        onClick: () => {
          estado.serviceType = "reparacion";
          pintar();
        },
        children: "Reparación",
      }),
      Chip({
        variant: "filter",
        active: estado.serviceType === "limpieza",
        leftIcon: Icon({ name: "sparkle", size: 16 }),
        onClick: () => {
          estado.serviceType = "limpieza";
          pintar();
        },
        children: "Limpieza",
      })
    );

    bloque.append(etiqueta, fila);
    return bloque;
  }

  function crearDescripcion() {
    const bloque = document.createElement("section");
    bloque.className = "cotizar__bloque";

    const etiqueta = document.createElement("h2");
    etiqueta.className = "cotizar__etiqueta";
    etiqueta.textContent = "Describe el problema";

    const area = TextArea({
      placeholder: "La suela izquierda está despegada y el cuero tiene manchas de agua.",
      value: estado.description,
      onChange: (valor) => {
        estado.description = valor;
      },
      rows: window.matchMedia("(min-width: 1024px)").matches ? 8 : 4,
    });
    area.classList.add("cotizar__descripcion");

    bloque.append(etiqueta, area);
    return bloque;
  }

  function crearAcciones() {
    const barra = StickyActionBar({
      children: Button({
        variant: "primary",
        fullWidth: true,
        leftIcon: "send",
        onClick: () => {
          // TODO(BACKEND): crear la solicitud con createRequestDraft,
          // addRequestPhoto y sendRequest; la subida de fotos es Nivel 3.
          irA("/pedidos");
        },
        children: "Enviar solicitud",
      }),
    });
    barra.classList.add("cotizar__acciones");
    return barra;
  }

  function pintar() {
    const cabecera = PageHeader({ title: "Solicitar cotización" });

    const izquierda = document.createElement("div");
    izquierda.className = "cotizar__columna cotizar__columna--izquierda";
    izquierda.append(crearTaller(), crearFotos());

    const derecha = document.createElement("div");
    derecha.className = "cotizar__columna cotizar__columna--derecha";
    derecha.append(crearServicio(), crearDescripcion(), crearAcciones());

    const grid = document.createElement("div");
    grid.className = "cotizar__grid";
    grid.append(izquierda, derecha);

    contenido.replaceChildren(cabecera, grid);
  }

  pintar();
  return shell;
}
