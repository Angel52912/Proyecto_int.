// Se ejecuta en <head> antes de pintar la página, para que no parpadee:
// - aplica el tema guardado (Claro u Oscuro); la lógica completa está en ui/tema.js.
// - marca <html data-escritorio> si la ventana mide 1024px o más; ui/escritorio.js lo mantiene al día.
(() => {
  try {
    const tema = window.localStorage.getItem("mixanab-tema");
    if (tema === "claro" || tema === "oscuro") document.documentElement.setAttribute("data-tema", tema);
  } catch {
    // Sin almacenamiento: se usa el tema del sistema.
  }
  if (window.matchMedia?.("(min-width: 1024px)").matches) document.documentElement.setAttribute("data-escritorio", "");
})();
