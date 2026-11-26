// Aplica el tema guardado (Claro u Oscuro) antes de que se pinte la página, para que no parpadee.
// Script clásico y mínimo: se carga en <head> antes de los estilos. La lógica completa está en ui/tema.js.
(() => {
  try {
    const tema = window.localStorage.getItem("mixanab-tema");
    if (tema === "claro" || tema === "oscuro") document.documentElement.setAttribute("data-tema", tema);
  } catch {
    // Sin almacenamiento: se usa el tema del sistema.
  }
})();
