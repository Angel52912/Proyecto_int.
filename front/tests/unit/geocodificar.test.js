import {
  consultaDeDireccion,
  detalleDeNominatim,
  direccionDeNominatim,
  elegirResultado,
  partesDeDireccion,
  puntoDeNominatim,
} from "../../js/lib/geocodificar.js";

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

  test("convierte el primer resultado de búsqueda en un punto del mapa", () => {
    expect(puntoDeNominatim([{ lat: "20.9674", lon: "-89.6237" }, { lat: "1", lon: "2" }])).toEqual({ lat: 20.9674, lng: -89.6237 });
    expect(puntoDeNominatim([{ lat: 20.9674, lon: -89.6237 }])).toEqual({ lat: 20.9674, lng: -89.6237 });
    expect(puntoDeNominatim([])).toBeNull();
    expect(puntoDeNominatim([{ lat: "x", lon: "-89" }])).toBeNull();
  });

  test("la consulta quita # y C.P. para que Nominatim encuentre la dirección", () => {
    expect(consultaDeDireccion({ direccion: "Calle 62 #512", colonia: "Centro", codigoPostal: "C.P. 97000" })).toBe(
      "Calle 62 512, Centro, 97000, Mérida, Yucatán, México",
    );
    expect(consultaDeDireccion({ direccion: "C. 59   #498", colonia: "", codigoPostal: "97130" })).toBe(
      "C. 59 498, 97130, Mérida, Yucatán, México",
    );
  });

  test("separa calle y número para la búsqueda estructurada", () => {
    expect(partesDeDireccion({ direccion: "C. 62 #512", colonia: "", codigoPostal: "" })).toEqual({ calle: "C. 62", numero: "512" });
    expect(partesDeDireccion({ direccion: "Calle 21 #300, Altabrisa", colonia: "", codigoPostal: "" })).toEqual({
      calle: "Calle 21",
      numero: "300",
    });
  });

  test("extrae el C.P. real del nombre de la colonia", () => {
    expect(detalleDeNominatim({ lat: "21.02", lon: "-89.58", category: "boundary", type: "administrative", display_name: "Fraccionamiento Altabrisa, Mérida, Yucatán, 97133, México" })).toMatchObject({
      categoria: "boundary",
      cp: "97133",
    });
  });

  test("elige el tramo cercano cuando Nominatim conoce la colonia", () => {
    const resultados = [
      { lat: "20.90", lon: "-89.70", display_name: "Calle 59, Caucel, Mérida, Yucatán, 97314, México" },
      { lat: "20.971", lon: "-89.621", display_name: "Calle 59, Centro, Mérida, Yucatán, 97000, México" },
    ];
    const centro = { punto: { lat: 20.9718, lng: -89.627 }, cp: "97000", fuerte: true };
    expect(elegirResultado(resultados, centro).punto).toEqual({ lat: 20.971, lng: -89.621 });
    expect(elegirResultado(resultados, { ...centro, fuerte: false }).punto).toEqual({ lat: 20.9, lng: -89.7 });
  });
});
