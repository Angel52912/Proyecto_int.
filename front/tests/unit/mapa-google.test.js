// Google Maps (lib/mapa-google.js y apis/config-mapa.js): sin llave se sigue usando OpenStreetMap, y las direcciones de
// Google se convierten a los mismos campos que usa la pantalla del taller.
import { usaGoogleMaps } from "../../../apis/config-mapa.js";
import { categoriaDeGoogle, direccionDeGoogle } from "../../js/lib/mapa-google.js";

const componente = (long_name, ...types) => ({ long_name, short_name: long_name, types });

test("sin llave la app usa OpenStreetMap", () => {
  expect(usaGoogleMaps()).toBe(false);
});

test("dirección de Google en los campos del taller (calle con número, colonia y C.P.)", () => {
  const resultado = {
    address_components: [
      componente("500", "street_number"),
      componente("Calle 60", "route"),
      componente("Centro", "sublocality_level_1", "sublocality", "political"),
      componente("Mérida", "locality", "political"),
      componente("97000", "postal_code"),
    ],
    types: ["street_address"],
  };
  expect(direccionDeGoogle(resultado)).toEqual({ direccion: "Calle 60 #500", colonia: "Centro", codigoPostal: "97000" });
  expect(categoriaDeGoogle(resultado).categoria).toBe("house");
});

test("sin número exacto: solo la calle, y se avisa que hay que ajustar el punto", () => {
  const resultado = { address_components: [componente("Calle 21", "route"), componente("Itzimná", "neighborhood", "political")], types: ["route"] };
  expect(direccionDeGoogle(resultado)).toEqual({ direccion: "Calle 21", colonia: "Itzimná", codigoPostal: "" });
  expect(categoriaDeGoogle(resultado).categoria).toBe("highway");
  expect(direccionDeGoogle({ address_components: [componente("México", "country")] })).toBeNull();
});
