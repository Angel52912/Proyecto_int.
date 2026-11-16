// Datos de muestra del chat de una solicitud (CU-03).
// TODO(BACKEND): reemplazar por listMessages/sendMessage reales.
//
// La forma es la del diseño (header/context/messages). El contrato define
// `Mensaje = { id, request_id, sender_id, body, kind, quote_id?, created_at }`;
// aquí `from`, `type`, `text`, `time`, `amount` y `delivery` son solo
// presentación para esta pantalla.

export const chatHeader = { initials: "DC", name: "Don Chucho", status: "En línea" };

export const chatContext = { requestId: "1042", item: "Botas café", service: "Reparación" };

export const chatMessages = [
  {
    id: 1,
    from: "me",
    type: "text",
    text: "Hola, ¿la suela se puede pegar o hay que cambiarla?",
    time: "10:21",
  },
  {
    id: 2,
    from: "them",
    type: "text",
    text: "Por las fotos conviene cambiarla. ¿Me compartes una foto de la planta?",
    time: "10:24",
  },
  { id: 3, from: "me", type: "image", time: "" },
  {
    id: 4,
    from: "them",
    type: "text",
    text: "Perfecto, te mando el presupuesto en un momento.",
    time: "10:30",
  },
  {
    id: 5,
    from: "them",
    type: "quote",
    amount: "$450 MXN",
    delivery: "Entrega: 18 nov",
  },
];
