// Datos de muestra del presupuesto de una solicitud (CU-04).
// TODO(BACKEND): reemplazar por getQuote/listQuotes y respondQuote reales.
//
// Los importes son texto ya formateado: la pantalla no suma ni calcula totales.
// Los campos de contrato (id, request_id, workshop_id, amount_mxn, delivery_date,
// detail, status) siguen docs/contrato-api.md y son solo de muestra; `workshopName`,
// `rating`, `title`, `description`, `lines`, `total`, `delivery`, `time` y `notice`
// son texto de presentación del diseño. Los ids son los del flujo de muestra.

const titulo = "Cambio de suela y limpieza";
const descripcion =
  "Suela de cuero nueva, costura reforzada y limpieza profunda con nutrición del cuero.";
const lineas = [
  { label: "Suela de cuero", amount: "$300" },
  { label: "Limpieza y nutrición", amount: "$150" },
];

export const budget = {
  id: "presupuesto-1042",
  request_id: "1042",
  workshop_id: "don-chucho",
  amount_mxn: 450,
  delivery_date: "2026-11-18",
  status: "sent",
  detail: { title: titulo, description: descripcion, lines: lineas },
  workshopName: "Talabartería Don Chucho",
  rating: 4.9,
  title: titulo,
  description: descripcion,
  lines: lineas,
  total: "$450 MXN",
  delivery: "18 nov",
  time: "5 días",
  notice: "Pagas al recoger tu calzado, después de verificar la entrega.",
};
