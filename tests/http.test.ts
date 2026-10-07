import assert from "node:assert/strict";
import { test } from "node:test";

const testUrl = process.env.TOCA_TEST_BASE_URL;

test("el login y las rutas privadas no filtran datos ni usan caché compartida", { skip: !testUrl }, async () => {
  const origin = new URL(testUrl!).origin;
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname), "Esta comprobación solo se ejecuta contra un servidor local.");

  for (const path of ["/ingresar", "/panel", "/panel/nuevo", "/panel/1/editar", "/panel/usuarios", "/panel/1", "/cuenta/clave", "/cuenta/seguridad"]) {
    const response = await fetch(origin + path, { redirect: "manual" });
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    assert.equal(response.headers.get("x-powered-by"), null);
    if (path === "/ingresar") {
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.ok(html.includes('name="password"'));
      assert.ok(!html.includes("gustaolobosas@gmail.com"));
    } else {
      assert.equal(response.status, 307);
      assert.equal(new URL(response.headers.get("location")!, origin).pathname, "/ingresar");
    }
  }
});
