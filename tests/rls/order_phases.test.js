import { abrirTransaccion, actuarComo, actuarSinUsuario, asignarRol, cerrarTransaccion, crearUsuario, intentar } from "../helpers/db.js";
import { crearOrden, crearPresupuesto } from "../helpers/presupuestos.js";
import { PERMISO_DENEGADO, UUID_A, UUID_B, crearSolicitud, crearTallerPublicado } from "../helpers/solicitudes.js";

/** CU-05: order_updates, advance_phase, mark_ready y bucket progress-photos (flujo principal y alternos). */
describe("fases del pedido (CU-05)", () => {
  /** @type {import("pg").Client} */
  let c;
  let n = 0;
  const correo = () => `fases-${Date.now()}-${n++}@prueba.test`;
  const AJENA = "99999999-9999-4999-8999-999999999999";

  beforeAll(async () => {
    c = await abrirTransaccion();
  });

  afterAll(async () => {
    await cerrarTransaccion(c);
  });

  /** @param {"client" | "craftsman" | "admin" | null} rol */
  async function usuarioConRol(rol) {
    const uid = await crearUsuario(c, correo());
    if (rol) await asignarRol(c, uid, rol);
    return uid;
  }

  /** Cliente, artesano, taller y una orden `in_progress` en la fase indicada. */
  async function escenario(fase = 1) {
    const cliente = await usuarioConRol("client");
    const artesano = await usuarioConRol("craftsman");
    const taller = await crearTallerPublicado(c, artesano);
    const solicitud = await crearSolicitud(c, cliente, taller, "accepted");
    const quote = await crearPresupuesto(c, solicitud, "accepted");
    const orden = await crearOrden(c, { quote, request: solicitud, cliente, taller });
    if (fase !== 1) await c.query("update public.orders set phase = $2 where id = $1", [orden, fase]);
    return { cliente, artesano, taller, solicitud, orden };
  }

  /** Simula un archivo ya subido a Storage (como superusuario) y devuelve su ruta. */
  async function subirArchivo(/** @type {string} */ orden, uuid = UUID_A) {
    await c.query("reset role");
    const ruta = `${orden}/${uuid}`;
    await c.query("insert into storage.objects (bucket_id, name) values ('progress-photos', $1)", [ruta]);
    return ruta;
  }

  const avanzar = (
    /** @type {string} */ orden,
    /** @type {number} */ fase,
    /** @type {string | null} */ ruta,
    /** @type {string | null} */ nota = null,
    /** @type {boolean} */ confirmar = false,
  ) => intentar(c, "select public.advance_phase($1, $2, $3, $4, $5) as r", [orden, fase, ruta, nota, confirmar]);
  const listo = (/** @type {string} */ orden) => intentar(c, "select public.mark_ready($1) as r", [orden]);

  async function leerOrden(/** @type {string} */ orden) {
    await c.query("reset role");
    return (await c.query("select phase, status, ready_at from public.orders where id = $1", [orden])).rows[0];
  }
  async function tiposDeNotificacion(/** @type {string} */ uid) {
    await c.query("reset role");
    return (await c.query("select type from public.notifications where user_id = $1 order by created_at, type", [uid])).rows.map((r) => r.type);
  }

  describe("advance_phase", () => {
    test("flujo principal: avanza una fase, registra el avance y avisa al cliente", async () => {
      const { cliente, artesano, orden } = await escenario(1);
      const ruta = await subirArchivo(orden);
      await actuarComo(c, artesano);
      const r = await avanzar(orden, 2, ruta, "Desinfección lista");
      expect(r.error).toBeNull();
      expect(r.rows[0].r).toMatchObject({
        order_id: orden,
        phase: 2,
        status: "in_progress",
        update: { phase: 2, photo_path: ruta, note: "Desinfección lista", corrected: false, created_by: artesano },
      });
      expect(await leerOrden(orden)).toMatchObject({ phase: 2, status: "in_progress" });
      expect(await tiposDeNotificacion(cliente)).toContain("order_phase_changed");

      await actuarComo(c, cliente);
      expect((await intentar(c, "select phase from public.order_updates where order_id = $1", [orden])).rows).toEqual([{ phase: 2 }]);
    });

    test("recorre las 4 fases de una en una", async () => {
      const { artesano, orden } = await escenario(1);
      await actuarComo(c, artesano);
      for (const fase of [2, 3, 4]) {
        const ruta = await subirArchivo(orden, `${fase}${fase}${fase}${fase}${fase}${fase}${fase}${fase}-1111-4111-8111-111111111111`);
        await actuarComo(c, artesano);
        expect((await avanzar(orden, fase, ruta)).error).toBeNull();
      }
      expect((await leerOrden(orden)).phase).toBe(4);
    });

    test("A1: un salto o un retroceso exige confirmar y nota, y queda corrected", async () => {
      const { artesano, orden } = await escenario(2);
      const ruta = await subirArchivo(orden);
      await actuarComo(c, artesano);
      expect((await avanzar(orden, 4, ruta)).error?.message).toContain("confirmation_required");
      expect((await avanzar(orden, 4, ruta, "Se saltó la 3", false)).error?.message).toContain("confirmation_required");
      expect((await avanzar(orden, 4, ruta, null, true)).error?.message).toContain("confirmation_required");
      expect((await avanzar(orden, 4, ruta, "   ", true)).error?.message).toContain("confirmation_required");
      expect((await leerOrden(orden)).phase).toBe(2);

      const salto = await avanzar(orden, 4, ruta, "Se saltó la 3", true);
      expect(salto.error).toBeNull();
      expect(salto.rows[0].r.update).toMatchObject({ phase: 4, corrected: true, note: "Se saltó la 3" });

      const ruta2 = await subirArchivo(orden, UUID_B);
      await actuarComo(c, artesano);
      const atras = await avanzar(orden, 1, ruta2, "Error de captura", true);
      expect(atras.error).toBeNull();
      expect(atras.rows[0].r.update.corrected).toBe(true);
      expect((await leerOrden(orden)).phase).toBe(1);
    });

    test("confirmar un avance normal no lo marca corregido", async () => {
      const { artesano, orden } = await escenario(1);
      const ruta = await subirArchivo(orden);
      await actuarComo(c, artesano);
      const r = await avanzar(orden, 2, ruta, null, true);
      expect(r.error).toBeNull();
      expect(r.rows[0].r.update.corrected).toBe(false);
    });

    test("la foto es obligatoria siempre: sin ruta o sin archivo en Storage lanza photo_required", async () => {
      const { artesano, orden } = await escenario(1);
      await actuarComo(c, artesano);
      expect((await avanzar(orden, 2, null)).error?.message).toContain("photo_required");
      expect((await avanzar(orden, 2, "  ")).error?.message).toContain("photo_required");
      expect((await avanzar(orden, 2, `${orden}/${UUID_A}`)).error?.message).toContain("photo_required");
      // También en una corrección confirmada.
      expect((await avanzar(orden, 4, `${orden}/${UUID_A}`, "Salto", true)).error?.message).toContain("photo_required");
      expect((await leerOrden(orden)).phase).toBe(1);
    });

    test("ruta de otro pedido, mal formada o ya usada: invalid_input", async () => {
      const { artesano, orden } = await escenario(1);
      const otro = await escenario(1);
      const rutaAjena = await subirArchivo(otro.orden);
      const ruta = await subirArchivo(orden);
      await actuarComo(c, artesano);
      expect((await avanzar(orden, 2, rutaAjena)).error?.message).toContain("invalid_input");
      expect((await avanzar(orden, 2, "no-es-una-ruta")).error?.message).toContain("invalid_input");
      expect((await avanzar(orden, 2, ruta)).error).toBeNull();
      expect((await avanzar(orden, 3, ruta)).error?.message).toContain("invalid_input");
    });

    test("misma fase, fase fuera de 1 a 4, nota de más de 500 caracteres o ids nulos: invalid_input", async () => {
      const { artesano, orden } = await escenario(2);
      const ruta = await subirArchivo(orden);
      await actuarComo(c, artesano);
      expect((await avanzar(orden, 2, ruta)).error?.message).toContain("invalid_input");
      expect((await avanzar(orden, 0, ruta)).error?.message).toContain("invalid_input");
      expect((await avanzar(orden, 5, ruta)).error?.message).toContain("invalid_input");
      expect((await avanzar(orden, 3, ruta, "x".repeat(501))).error?.message).toContain("invalid_input");
      expect((await avanzar(null, 3, ruta)).error?.message).toContain("invalid_input");
    });

    test("cliente, usuario sin rol y admin lanzan forbidden", async () => {
      const { cliente, orden } = await escenario(1);
      const ruta = await subirArchivo(orden);
      for (const uid of [cliente, await usuarioConRol(null), await usuarioConRol("admin")]) {
        await actuarComo(c, uid);
        expect((await avanzar(orden, 2, ruta)).error?.message).toContain("forbidden");
      }
    });

    test("artesano de otro taller u orden inexistente: not_found", async () => {
      const { orden } = await escenario(1);
      const ruta = await subirArchivo(orden);
      await actuarComo(c, await usuarioConRol("craftsman"));
      expect((await avanzar(orden, 2, ruta)).error?.message).toContain("not_found");
      expect((await avanzar(AJENA, 2, ruta)).error?.message).toContain("not_found");
    });

    test("anónimo: permission denied; token sin usuario: not_authenticated; artesano inactivo: inactive_user", async () => {
      const { artesano, orden } = await escenario(1);
      const ruta = await subirArchivo(orden);
      await actuarComo(c, null);
      expect((await avanzar(orden, 2, ruta)).error?.code).toBe(PERMISO_DENEGADO);
      await actuarSinUsuario(c);
      expect((await avanzar(orden, 2, ruta)).error?.message).toContain("not_authenticated");
      await c.query("reset role");
      await c.query("update public.profiles set active = false where id = $1", [artesano]);
      await actuarComo(c, artesano);
      expect((await avanzar(orden, 2, ruta)).error?.message).toContain("inactive_user");
    });

    test("taller suspendido: forbidden; pedido que no está en curso: invalid_state", async () => {
      const { artesano, taller, orden } = await escenario(1);
      const ruta = await subirArchivo(orden);
      await c.query("update public.workshops set suspended = true where id = $1", [taller]);
      await actuarComo(c, artesano);
      expect((await avanzar(orden, 2, ruta)).error?.message).toContain("forbidden");
      await c.query("reset role");
      await c.query("update public.workshops set suspended = false where id = $1", [taller]);
      for (const estado of ["ready", "delivered", "cancelled"]) {
        await c.query("update public.orders set status = $2::public.order_status where id = $1", [orden, estado]);
        await actuarComo(c, artesano);
        expect((await avanzar(orden, 2, ruta)).error?.message).toContain("invalid_state");
        await c.query("reset role");
      }
    });

    test("el rol authenticated no ejecuta con anon ni public: grants de la función", async () => {
      await c.query("reset role");
      const { rows } = await c.query(
        `select has_function_privilege('anon', 'public.advance_phase(uuid, integer, text, text, boolean)', 'execute') as anon,
                has_function_privilege('authenticated', 'public.advance_phase(uuid, integer, text, text, boolean)', 'execute') as auth,
                has_function_privilege('anon', 'public.mark_ready(uuid)', 'execute') as anon_listo,
                has_function_privilege('authenticated', 'public.mark_ready(uuid)', 'execute') as auth_listo`,
      );
      expect(rows[0]).toEqual({ anon: false, auth: true, anon_listo: false, auth_listo: true });
    });
  });

  describe("mark_ready", () => {
    test("flujo principal: con la fase 4 marca listo, avisa al cliente y agrega mensaje de sistema", async () => {
      const { cliente, artesano, orden, solicitud } = await escenario(4);
      await actuarComo(c, artesano);
      const r = await listo(orden);
      expect(r.error).toBeNull();
      expect(r.rows[0].r).toMatchObject({ order_id: orden, status: "ready", phase: 4 });
      expect(r.rows[0].r.ready_at).toBeTruthy();
      expect(await leerOrden(orden)).toMatchObject({ status: "ready" });
      expect(await tiposDeNotificacion(cliente)).toContain("order_ready");

      await actuarComo(c, cliente);
      const mensajes = await intentar(c, "select kind, sender_id from public.messages where request_id = $1 and kind = 'system'", [solicitud]);
      expect(mensajes.rows).toEqual([{ kind: "system", sender_id: null }]);
    });

    test("antes de la fase 4 o ya listo: invalid_state", async () => {
      const { artesano, orden } = await escenario(3);
      await actuarComo(c, artesano);
      expect((await listo(orden)).error?.message).toContain("invalid_state");
      await c.query("reset role");
      await c.query("update public.orders set phase = 4 where id = $1", [orden]);
      await actuarComo(c, artesano);
      expect((await listo(orden)).error).toBeNull();
      expect((await listo(orden)).error?.message).toContain("invalid_state");
    });

    test("cliente, sin rol y admin: forbidden; otro artesano u orden inexistente: not_found", async () => {
      const { cliente, orden } = await escenario(4);
      for (const uid of [cliente, await usuarioConRol(null), await usuarioConRol("admin")]) {
        await actuarComo(c, uid);
        expect((await listo(orden)).error?.message).toContain("forbidden");
      }
      await actuarComo(c, await usuarioConRol("craftsman"));
      expect((await listo(orden)).error?.message).toContain("not_found");
      expect((await listo(AJENA)).error?.message).toContain("not_found");
    });

    test("anónimo: permission denied; token sin usuario: not_authenticated; id nulo: invalid_input", async () => {
      const { artesano, orden } = await escenario(4);
      await actuarComo(c, null);
      expect((await listo(orden)).error?.code).toBe(PERMISO_DENEGADO);
      await actuarSinUsuario(c);
      expect((await listo(orden)).error?.message).toContain("not_authenticated");
      await actuarComo(c, artesano);
      expect((await listo(/** @type {any} */ (null))).error?.message).toContain("invalid_input");
    });

    test("taller suspendido: forbidden", async () => {
      const { artesano, taller, orden } = await escenario(4);
      await c.query("update public.workshops set suspended = true where id = $1", [taller]);
      await actuarComo(c, artesano);
      expect((await listo(orden)).error?.message).toContain("forbidden");
    });
  });

  describe("tabla order_updates", () => {
    test("ven los avances el cliente y el artesano dueño; los demás no", async () => {
      const { cliente, artesano, orden } = await escenario(1);
      const ruta = await subirArchivo(orden);
      await actuarComo(c, artesano);
      await avanzar(orden, 2, ruta);
      for (const uid of [cliente, artesano]) {
        await actuarComo(c, uid);
        expect((await intentar(c, "select id from public.order_updates")).rows).toHaveLength(1);
      }
      for (const uid of [await usuarioConRol("client"), await usuarioConRol("craftsman"), await usuarioConRol("admin"), await usuarioConRol(null)]) {
        await actuarComo(c, uid);
        expect((await intentar(c, "select id from public.order_updates")).rows).toEqual([]);
      }
      await actuarComo(c, null);
      expect((await intentar(c, "select id from public.order_updates")).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("append-only: nadie inserta, actualiza ni borra desde la API", async () => {
      const { cliente, artesano, orden } = await escenario(1);
      const ruta = await subirArchivo(orden);
      await actuarComo(c, artesano);
      await avanzar(orden, 2, ruta);
      for (const uid of [artesano, cliente]) {
        await actuarComo(c, uid);
        const insertar = await intentar(
          c,
          "insert into public.order_updates (order_id, phase, photo_path, created_by) values ($1, 3, $2, $3)",
          [orden, `${orden}/${UUID_B}`, uid],
        );
        expect(insertar.error?.code).toBe(PERMISO_DENEGADO);
        expect((await intentar(c, "update public.order_updates set note = 'x'")).error?.code).toBe(PERMISO_DENEGADO);
        expect((await intentar(c, "delete from public.order_updates")).error?.code).toBe(PERMISO_DENEGADO);
      }
    });

    test("restricciones: ruta de otro pedido y corrección sin nota se rechazan incluso como superusuario", async () => {
      const { artesano, orden } = await escenario(1);
      await c.query("reset role");
      const ruta = await intentar(c, "insert into public.order_updates (order_id, phase, photo_path, created_by) values ($1, 2, $2, $3)", [
        orden,
        `${AJENA}/${UUID_A}`,
        artesano,
      ]);
      expect(ruta.error?.code).toBe("23514");
      const nota = await intentar(c, "insert into public.order_updates (order_id, phase, photo_path, corrected, created_by) values ($1, 2, $2, true, $3)", [
        orden,
        `${orden}/${UUID_A}`,
        artesano,
      ]);
      expect(nota.error?.code).toBe("23514");
    });
  });

  describe("bucket progress-photos", () => {
    const subir = (/** @type {string} */ ruta) => intentar(c, "insert into storage.objects (bucket_id, name) values ('progress-photos', $1) returning id", [ruta]);
    const leer = (/** @type {string} */ ruta) => intentar(c, "select id from storage.objects where bucket_id = 'progress-photos' and name = $1", [ruta]);

    test("configuración: privado, 5 MB y solo jpeg, png o webp", async () => {
      await c.query("reset role");
      const { rows } = await c.query("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'progress-photos'");
      expect(rows).toEqual([{ public: false, file_size_limit: 5242880, allowed_mime_types: ["image/jpeg", "image/png", "image/webp"] }]);
    });

    test("el artesano dueño sube con el pedido en curso", async () => {
      const { artesano, orden } = await escenario(1);
      await actuarComo(c, artesano);
      expect((await subir(`${orden}/${UUID_A}`)).error).toBeNull();
    });

    test("no sube con el pedido listo, entregado o cancelado, ni con el taller suspendido", async () => {
      const { artesano, taller, orden } = await escenario(1);
      for (const estado of ["ready", "delivered", "cancelled"]) {
        await c.query("reset role");
        await c.query("update public.orders set status = $2::public.order_status where id = $1", [orden, estado]);
        await actuarComo(c, artesano);
        expect((await subir(`${orden}/${UUID_A}`)).error?.code).toBe(PERMISO_DENEGADO);
      }
      await c.query("reset role");
      await c.query("update public.orders set status = 'in_progress' where id = $1", [orden]);
      await c.query("update public.workshops set suspended = true where id = $1", [taller]);
      await actuarComo(c, artesano);
      expect((await subir(`${orden}/${UUID_A}`)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("cliente, otro artesano, otro cliente, admin, sin rol y anónimo no suben", async () => {
      const { cliente, orden } = await escenario(1);
      const intrusos = [cliente, await usuarioConRol("craftsman"), await usuarioConRol("client"), await usuarioConRol("admin"), await usuarioConRol(null)];
      for (const uid of intrusos) {
        await actuarComo(c, uid);
        expect((await subir(`${orden}/${UUID_A}`)).error?.code).toBe(PERMISO_DENEGADO);
      }
      await actuarComo(c, null);
      expect((await subir(`${orden}/${UUID_A}`)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("carpeta que no es un UUID o de un pedido inexistente: denegado", async () => {
      const { artesano } = await escenario(1);
      await actuarComo(c, artesano);
      expect((await subir(`no-uuid/${UUID_A}`)).error?.code).toBe(PERMISO_DENEGADO);
      expect((await subir(`${AJENA}/${UUID_A}`)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("cliente y artesano dueño leen los archivos; los demás no", async () => {
      const { cliente, artesano, orden } = await escenario(1);
      const ruta = await subirArchivo(orden);
      for (const uid of [cliente, artesano]) {
        await actuarComo(c, uid);
        expect((await leer(ruta)).rows).toHaveLength(1);
      }
      for (const uid of [await usuarioConRol("client"), await usuarioConRol("craftsman"), await usuarioConRol("admin"), await usuarioConRol(null)]) {
        await actuarComo(c, uid);
        expect((await leer(ruta)).rows).toEqual([]);
      }
      await actuarComo(c, null);
      expect((await leer(ruta)).error?.code).toBe(PERMISO_DENEGADO);
    });

    test("el artesano borra un archivo huérfano pero no uno ya registrado en un avance", async () => {
      const { artesano, cliente, orden } = await escenario(1);
      const huerfano = await subirArchivo(orden, UUID_B);
      const usado = await subirArchivo(orden, UUID_A);
      await actuarComo(c, artesano);
      expect((await avanzar(orden, 2, usado)).error).toBeNull();

      const borrarUsado = await intentar(c, "delete from storage.objects where bucket_id = 'progress-photos' and name = $1", [usado]);
      expect(borrarUsado.rowCount).toBe(0);
      const borrarHuerfano = await intentar(c, "delete from storage.objects where bucket_id = 'progress-photos' and name = $1", [huerfano]);
      expect(borrarHuerfano.rowCount).toBe(1);

      await actuarComo(c, cliente);
      const borrarComoCliente = await intentar(c, "delete from storage.objects where bucket_id = 'progress-photos'");
      expect(borrarComoCliente.rowCount).toBe(0);
    });
  });
});
