import assert from "node:assert/strict";
import { test } from "node:test";
import config from "../next.config.ts";

test("todas las rutas incluyen protecciones contra iframes y filtración del referente", async () => {
  const rules = await config.headers!();
  const all = rules.find(rule => rule.source === "/:path*")!;
  const headers = Object.fromEntries(all.headers.map(header => [header.key, header.value]));
  assert.equal(config.poweredByHeader, false);
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["Referrer-Policy"], "no-referrer");
  assert.match(headers["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.match(headers["Content-Security-Policy"], /object-src 'none'/);
});
