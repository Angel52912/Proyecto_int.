import { abrirTransaccion, actuarComo, cerrarTransaccion, intentarBorradoStorage, intentar, sinAcceso, crearUsuarioFactory } from "../helpers/db.js";
import { UUID_A, UUID_B, crearTallerPublicado } from "../helpers/solicitudes.js";

/** Migración 0022: el artesano dueño lee y por tanto puede borrar los archivos de su carpeta en workshop-photos. */
describe("workshop-photos: lectura del dueño (0022)", () => {
  /** @type {import("pg").Client} */
  let c;

  beforeAll(async () => {
    c = await abrirTransaccion();
  });

  afterAll(async () => {
    await cerrarTransaccion(c);
  });

  /** @param {"client" | "craftsman" | "admin" | null} rol */
  const usuarioConRol = crearUsuarioFactory(c);

  async function conArchivo() {
    const artesano = await usuarioConRol("craftsman");
    const taller = await crearTallerPublicado(c, artesano);
    await c.query("insert into storage.objects (bucket_id, name) values ('workshop-photos', $1)", [`${taller}/${UUID_A}`]);
    return { artesano, taller, ruta: `${taller}/${UUID_A}` };
  }
  const leer = (/** @type {string} */ ruta) => intentar(c, "select name from storage.objects where bucket_id = 'workshop-photos' and name = $1", [ruta]);

  test("el artesano dueño ve el archivo de su taller", async () => {
    const e = await conArchivo();
    await actuarComo(c, e.artesano);
    expect((await leer(e.ruta)).rows).toEqual([{ name: e.ruta }]);
  });

  test("otro artesano, un cliente, el admin y un usuario sin rol no ven el archivo; anónimo sin acceso", async () => {
    const e = await conArchivo();
    for (const uid of [await usuarioConRol("craftsman"), await usuarioConRol("client"), await usuarioConRol("admin"), await usuarioConRol(null)]) {
      await actuarComo(c, uid);
      expect((await leer(e.ruta)).rows).toEqual([]);
    }
    await actuarComo(c, null);
    expect(sinAcceso(await leer(e.ruta))).toBe(true);
  });

  test("un artesano desactivado ya no lee ni lista (owns_workshop exige un artesano activo)", async () => {
    const e = await conArchivo();
    await c.query("update public.profiles set active = false where id = $1", [e.artesano]);
    await actuarComo(c, e.artesano);
    expect((await leer(e.ruta)).rows).toEqual([]);
  });

  test("una ruta con subcarpeta no se lee aunque la carpeta sea del dueño", async () => {
    const e = await conArchivo();
    const profunda = `${e.taller}/sub/${UUID_B}`;
    await c.query("insert into storage.objects (bucket_id, name) values ('workshop-photos', $1)", [profunda]);
    await actuarComo(c, e.artesano);
    expect((await leer(profunda)).rows).toEqual([]);
  });

  test("el dueño borra su archivo (SELECT y DELETE) y otro artesano no puede borrarlo", async () => {
    const e = await conArchivo();
    await actuarComo(c, await usuarioConRol("craftsman"));
    expect((await intentarBorradoStorage(c, "delete from storage.objects where bucket_id = 'workshop-photos' and name = $1", [e.ruta])).rowCount).toBe(0);
    await actuarComo(c, e.artesano);
    expect((await intentarBorradoStorage(c, "delete from storage.objects where bucket_id = 'workshop-photos' and name = $1", [e.ruta])).rowCount).toBe(1);
  });
});
