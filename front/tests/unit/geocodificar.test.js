import { direccionDeNominatim } from "../../js/lib/geocodificar.js";

describe("geocodificación inversa del mapa", () => {
  test("convierte calle, número, colonia y código postal de Nominatim", () => {
    const datos = {
      address: { road: "Calle 62", house_number: "512", neighbourhood: "Centro", postcode: "97000" },
    };
    expect(direccionDeNominatim(datos)).toEqual({ direccion: "Calle 62 #512", colonia: "Centro", codigoPostal: "97000" });
  });

  test("no duplica el # y limpia el código postal", () => {
    const datos = { address: { road: "C. 59", house_number: "#498", suburb: "Altabrisa", postcode: "CP 97130" } };
    expect(direccionDeNominatim(datos)).toEqual({ direccion: "C. 59 #498", colonia: "Altabrisa", codigoPostal: "97130" });
  });

  test("devuelve null cuando el lugar no tiene datos útiles", () => {
    expect(direccionDeNominatim({ display_name: "Mérida, Yucatán", address: { city: "Mérida" } })).toBeNull();
    expect(direccionDeNominatim({})).toBeNull();
  });
});
