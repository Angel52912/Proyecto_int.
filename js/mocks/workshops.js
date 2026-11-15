// Datos de muestra de las pantallas del cliente (Nivel 2).
// TODO(BACKEND): reemplazar por lógica real.
//
// Los campos de contrato (id, name, address, colonia, postal_code, lat, lng,
// services, hours, price_from, rating_avg, rating_count, distance_km, is_open)
// siguen docs/contrato-api.md. `tags`, `detail_tags`, `description` y
// `hours_label` son solo texto de presentación: el contrato no define un
// catálogo de etiquetas ni de descripciones.

/** @type {import("../features/workshop/validar.js").Horario} */
const HORARIO_DON_CHUCHO = {
  mon: [{ open: "09:00", close: "19:00" }],
  tue: [{ open: "09:00", close: "19:00" }],
  wed: [{ open: "09:00", close: "19:00" }],
  thu: [{ open: "09:00", close: "19:00" }],
  fri: [{ open: "09:00", close: "19:00" }],
  sat: [{ open: "09:00", close: "19:00" }],
  sun: [],
};

export const workshops = [
  {
    id: "don-chucho",
    name: "Talabartería Don Chucho",
    services: ["repair", "cleaning"],
    tags: ["Suelas", "Costuras", "Cuero"],
    detail_tags: ["Suelas", "Costuras", "Limpieza"],
    rating_avg: 4.9,
    rating_count: 128,
    distance_km: 0.8,
    address: "C. 62 #512, Centro, Mérida",
    colonia: "Centro",
    postal_code: "97000",
    lat: 20.9674,
    lng: -89.5926,
    hours: HORARIO_DON_CHUCHO,
    hours_label: "Abierto hasta 7 pm",
    is_open: true,
    price_from: 120,
    description:
      "Más de 30 años restaurando botas, huaraches y artículos de piel con técnicas tradicionales.",
    photos: [],
  },
  {
    id: "los-hermanos",
    name: "Calzado Los Hermanos",
    services: ["repair"],
    tags: ["Tacones", "Suelas"],
    rating_avg: 4.2,
    rating_count: 64,
    distance_km: 1.4,
    address: "",
    colonia: "García Ginerés",
    postal_code: "97070",
    lat: 20.9812,
    lng: -89.6329,
    hours: {},
    hours_label: "",
    is_open: false,
    price_from: 150,
    description: "",
    photos: [],
  },
  {
    id: "la-ermita",
    name: "Taller La Ermita",
    services: ["repair", "cleaning"],
    tags: ["Bolsas", "Cinturones", "Botas"],
    rating_avg: 4.1,
    rating_count: 40,
    distance_km: 2.1,
    address: "",
    colonia: "La Ermita",
    postal_code: "97000",
    lat: 20.9700,
    lng: -89.6200,
    hours: {},
    hours_label: "",
    is_open: false,
    price_from: 180,
    description: "",
    photos: [],
  },
  {
    id: "santiago",
    name: "Zapatería Santiago",
    services: ["repair"],
    tags: ["Reparación general"],
    rating_avg: 3.4,
    rating_count: 22,
    distance_km: 2.9,
    address: "",
    colonia: "Santiago",
    postal_code: "97000",
    lat: 20.9900,
    lng: -89.6100,
    hours: {},
    hours_label: "",
    is_open: false,
    price_from: 100,
    description: "",
    photos: [],
  },
];

/**
 * Busca un taller de muestra por id.
 * @param {string} id
 * @returns {(typeof workshops)[number] | null}
 */
export function getWorkshopById(id) {
  return workshops.find((taller) => taller.id === id) ?? null;
}
