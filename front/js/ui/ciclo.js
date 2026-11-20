// Limpieza al salir de una pantalla. El router cambia de vista en cada `hashchange`, así que ahí se cancelan
// suscripciones de tiempo real, mapas y URLs de vista previa.

/**
 * Ejecuta `limpiar` la próxima vez que cambie la ruta.
 * @param {() => void} limpiar
 */
export function alSalir(limpiar) {
  window.addEventListener(
    "hashchange",
    () => {
      try {
        limpiar();
      } catch {
        // La limpieza nunca debe romper la navegación.
      }
    },
    { once: true },
  );
}
