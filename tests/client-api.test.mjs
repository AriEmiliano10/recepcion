import assert from "node:assert/strict";
import test from "node:test";

globalThis.window = { SR: {}, location: { replacedWith: "", replace(path) { this.replacedWith = path; } } };

await import("../js/servicios/api.js");
await import("../js/servicios/auth.js");
await import("../js/servicios/visitas.js");

test("API client sends same-origin JSON and reports server errors", async () => {
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ ok: true, sesion: { rol: "RECEPCION" } }) };
  };

  const result = await window.SR.api.solicitar("auth/login", {
    method: "POST",
    body: { usuario: "recepcion", contrasena: "test-password" }
  });
  assert.equal(result.sesion.rol, "RECEPCION");
  assert.equal(request.url, "/api/auth/login");
  assert.equal(request.options.credentials, "same-origin");
  assert.equal(request.options.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(request.options.body), { usuario: "recepcion", contrasena: "test-password" });

  globalThis.fetch = async () => ({
    ok: false,
    status: 401,
    json: async () => ({ ok: false, error: "No autorizado." })
  });
  await assert.rejects(window.SR.api.solicitar("auth/session"), { status: 401, message: "No autorizado." });
});

test("auth redirects using the backend role and treats an expired session as signed out", async () => {
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    if (url === "/api/auth/login") {
      return { ok: true, json: async () => ({ ok: true, sesion: { rol: "EMPRESA", panel: "empresa.html" } }) };
    }
    return { ok: false, status: 401, json: async () => ({ ok: false, error: "Sesión expirada." }) };
  };

  const session = await window.SR.auth.iniciarSesion("ALFA", "test-password");
  assert.equal(session.panel, "empresa.html");
  assert.equal(requests[0].url, "/api/auth/login");
  assert.deepEqual(await window.SR.auth.sesionActual(), null);
  assert.equal(await window.SR.auth.protegerPagina("EMPRESA"), null);
  assert.equal(window.location.replacedWith, "index.html");
});

test("visit service refreshes its cache and sends state changes to the API", async () => {
  const visit = { id: "vis-test", folio: "VIS-TEST", estado: "PROGRAMADA" };
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    const body = url === "/api/visits"
      ? { ok: true, visitas: [visit] }
      : { ok: true, visita: { ...visit, estado: "EN_ESPERA" } };
    return { ok: true, json: async () => body };
  };

  assert.deepEqual(await window.SR.visitas.visibles({ rol: "RECEPCION" }), [visit]);
  assert.equal(window.SR.visitas.buscar("vis-test"), visit);
  await window.SR.visitas.marcarLlegada("vis-test");
  assert.equal(requests[1].url, "/api/visits/vis-test/arrival");
  assert.equal(requests[1].options.method, "POST");
  assert.equal(window.SR.visitas.buscar("vis-test").estado, "EN_ESPERA");
});
