import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { startFixture, adminId, secretKey } from "./supabase-fixture.mjs";

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require("playwright"); }
catch {
  playwright = require(process.env.TOCA_PLAYWRIGHT_PATH ?? "/Users/gustavolobos/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
}
const fixture = await startFixture();
const origin = "http://127.0.0.1:3212";
const checks = [];
const check = (name, result) => { assert.ok(result, name); checks.push(name); console.log(`PASS ${name}`); };
let logs = "", browser;
const consoleErrors = [], externalRequests = [];
const dev = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3212"], {
  env: { ...process.env, NODE_ENV: "development", VERCEL_ENV: "", NEXT_PUBLIC_SITE_URL: origin,
    NEXT_PUBLIC_SUPABASE_URL: fixture.origin, SUPABASE_URL: fixture.origin,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_only", SUPABASE_SECRET_KEY: secretKey,
    ADMIN_USER_ID: adminId, SUPABASE_DB_PASSWORD: "", NEXT_TELEMETRY_DISABLED: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});
dev.stdout.on("data", chunk => { logs += chunk; }); dev.stderr.on("data", chunk => { logs += chunk; });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function createContext(options = {}) {
  const context = await browser.newContext({ reducedMotion: "reduce", ...options });
  context.on("page", page => page.on("pageerror", error => consoleErrors.push(error.message)));
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (["http:", "https:"].includes(url.protocol) && ![origin, fixture.origin].includes(url.origin)) {
      externalRequests.push(url.origin); return route.abort();
    }
    return route.continue();
  });
  return context;
}

async function login(page, email, password, expected = "/panel") {
  await page.goto(`${origin}/ingresar`);
  await page.getByLabel("Correo", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(url => url.pathname === expected, { timeout: 20000 });
  await page.getByRole("heading", { level: 1 }).waitFor();
}
async function changePassword(page, current, next) {
  await page.getByLabel("Contraseña actual", { exact: true }).fill(current);
  await page.getByLabel("Nueva contraseña", { exact: true }).fill(next);
  await page.getByLabel("Repite la nueva contraseña", { exact: true }).fill(next);
  await page.getByRole("button", { name: "Guardar contraseña", exact: true }).click();
  await page.waitForURL(/ingresar\?password_changed=1/);
  await sleep(1100); // El límite de iat excluye todos los tokens emitidos antes del cambio.
}
async function createAccount(page, name, email) {
  await page.goto(`${origin}/panel/usuarios`);
  await page.getByLabel("Nombre", { exact: true }).fill(name);
  await page.getByLabel("Correo", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Crear usuario", exact: true }).click();
  const receipt = page.getByLabel("Contraseña temporal", { exact: true });
  await receipt.waitFor(); return receipt.inputValue();
}
async function edit(page, id, type, destination) {
  await page.goto(`${origin}/panel/${id}/editar`);
  await page.getByLabel("Tipo de destino").selectOption(type);
  await page.locator('input[name="destination"]').fill(destination);
  await page.getByLabel("NFC activo", { exact: true }).check();
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await page.waitForURL(/panel\?updated=1/);
}

try {
  for (let attempt = 0; attempt < 160; attempt++) {
    if (dev.exitCode !== null) throw new Error("Next.js no pudo iniciar.");
    try { if ((await fetch(`${origin}/ingresar`, { signal: AbortSignal.timeout(5000) })).status === 200) break; } catch { /* Arranque. */ }
    await sleep(250);
  }
  browser = await playwright.chromium.launch({ headless: true, channel: "chrome" });
  const context = await createContext({ viewport: { width: 1440, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });
  const admin = await context.newPage();
  const guest = await admin.goto(`${origin}/panel`);
  check("El invitado termina en el login sin datos privados", admin.url().endsWith("/ingresar") && guest.status() === 200);
  const response = await context.request.get(`${origin}/panel/nuevo`, { maxRedirects: 0 });
  console.log("Respuesta privada anónima:", response.status(), response.headers()["cache-control"]);
  check("La ruta privada redirige y exige revalidación en desarrollo", response.status() === 307 && /no-cache|no-store/.test(response.headers()["cache-control"]));
  await login(admin, "admin@example.com", "SoloTest123!abc", "/cuenta/clave");
  check("La primera entrada exige cambiar contraseña", admin.url().endsWith("/cuenta/clave"));
  await changePassword(admin, "SoloTest123!abc", "FraseAdminNueva2026!solo");
  check("Cambiar contraseña cierra la sesión", admin.url().includes("password_changed=1"));
  await login(admin, "admin@example.com", "FraseAdminNueva2026!solo", "/cuenta/seguridad");
  check("El administrador no entra sin MFA", admin.url().endsWith("/cuenta/seguridad"));
  await admin.getByRole("button", { name: "Configurar segundo factor" }).click();
  await admin.getByLabel("Código de verificación").fill("000000");
  await admin.getByRole("button", { name: "Verificar y entrar" }).click();
  await admin.getByRole("alert").waitFor();
  check("Un código MFA incorrecto no abre el panel", admin.url().endsWith("/cuenta/seguridad"));
  await admin.getByLabel("Código de verificación").fill("123456");
  await admin.getByRole("button", { name: "Verificar y entrar" }).click();
  await admin.waitForURL(`${origin}/panel`);
  const passwordA = await createAccount(admin, "TOCA E2E A", "e2e-a@example.com");
  const passwordB = await createAccount(admin, "TOCA E2E B", "e2e-b@example.com");
  check("Las contraseñas temporales son individuales y largas", passwordA !== passwordB && passwordA.length >= 24 && passwordB.length >= 24);
  check("Las contraseñas temporales no aparecen en los logs de Next.js", !logs.includes(passwordA) && !logs.includes(passwordB));
  const ownerA = fixture.profiles.find(item => item.email === "e2e-a@example.com");
  const ownerB = fixture.profiles.find(item => item.email === "e2e-b@example.com");
  await admin.goto(`${origin}/panel/nuevo`);
  await admin.getByLabel("Nombre del NFC").fill("Mostrador E2E");
  await admin.getByLabel("Propietario", { exact: true }).selectOption(ownerA.id);
  await admin.getByLabel("Usuario de Instagram").fill("@toca_prueba");
  await admin.getByRole("button", { name: "Crear enlace", exact: true }).click();
  await admin.waitForURL(/panel\?created=1/);
  const tag = fixture.links[0], stableSlug = tag.slug;
  check("Crear NFC asigna propietario y normaliza Instagram", tag.owner_id === ownerA.id && tag.destination_url === "https://www.instagram.com/toca_prueba/");
  const firstTap = await context.request.get(`${origin}/t/${stableSlug}`, { maxRedirects: 0 });
  check("El toque registra y redirige directamente", firstTap.status() === 302 && firstTap.headers().location === tag.destination_url && fixture.events.length === 1);
  await context.request.head(`${origin}/t/${stableSlug}`, { maxRedirects: 0 });
  await context.request.get(`${origin}/t/${stableSlug}`, { maxRedirects: 0, headers: { purpose: "prefetch" } });
  check("HEAD y prefetch no inflan las visitas", fixture.events.length === 1);
  const customerContext = await createContext({ viewport: { width: 390, height: 844 } });
  const customer = await customerContext.newPage();
  await login(customer, ownerA.email, passwordA, "/cuenta/clave");
  await changePassword(customer, passwordA, "FraseClienteNueva2026!solo");
  await login(customer, ownerA.email, "FraseClienteNueva2026!solo");
  check("El propietario ve su NFC y no la administración", await customer.getByRole("heading", { name: "Mostrador E2E" }).count() === 1 && await customer.getByRole("link", { name: "Usuarios", exact: true }).count() === 0);
  const denied = await customer.goto(`${origin}/panel/usuarios`);
  check("La URL administrativa tampoco permite entrar", denied.status() === 404);
  await edit(customer, tag.id, "whatsapp", "+56 9 1234 5678");
  check("WhatsApp se guarda como número internacional", tag.destination_url === "https://wa.me/56912345678");
  await context.request.get(`${origin}/t/${stableSlug}`, { maxRedirects: 0 });
  await edit(customer, tag.id, "google_review", "https://g.page/r/NegocioPrueba/review");
  await context.request.get(`${origin}/t/${stableSlug}`, { maxRedirects: 0 });
  await edit(customer, tag.id, "generic", "https://example.com/menu");
  check("Los cuatro destinos conservan la URL NFC", tag.slug === stableSlug && fixture.history.length === 4);
  await customer.goto(`${origin}/panel/${tag.id}/editar`);
  await customer.getByLabel("URL de destino", { exact: true }).fill("https://toca-one.vercel.app/t/loop1234");
  await customer.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await customer.waitForURL(/error=/);
  check("Un destino circular se rechaza y no modifica datos", tag.destination_url === "https://example.com/menu");
  await admin.goto(`${origin}/panel/${tag.id}`);
  await admin.getByLabel("Nuevo propietario", { exact: true }).selectOption(ownerB.id);
  await admin.getByLabel("Confirmo que se transferirá todo el historial al nuevo propietario.").check();
  await admin.getByRole("button", { name: "Reasignar y pausar NFC" }).click();
  await admin.waitForURL(/transferred=1/);
  check("Reasignar pausa y exige un destino nuevo", tag.owner_id === ownerB.id && !tag.is_active && tag.requires_configuration && tag.slug === stableSlug);
  const oldOwner = await customer.goto(`${origin}/panel/${tag.id}/editar`);
  check("El propietario anterior pierde acceso incluso por URL", oldOwner.status() === 404);
  const paused = await context.request.get(`${origin}/t/${stableSlug}`, { maxRedirects: 0 });
  check("Un NFC pausado no registra ni redirige al destino anterior", paused.headers().location.endsWith("/enlace-no-disponible") && fixture.events.length === 3);
  const newContext = await createContext({ viewport: { width: 390, height: 844 } }); const newOwner = await newContext.newPage();
  await login(newOwner, ownerB.email, passwordB, "/cuenta/clave");
  await changePassword(newOwner, passwordB, "OtraFraseCliente2026!solo");
  await login(newOwner, ownerB.email, "OtraFraseCliente2026!solo");
  await newOwner.goto(`${origin}/panel/${tag.id}`);
  check("El nuevo dueño recibe todos los destinos anteriores", (await newOwner.locator("body").textContent()).includes("https://wa.me/56912345678"));
  await edit(newOwner, tag.id, "instagram", "negocio_nuevo");
  await admin.goto(`${origin}/panel/usuarios`);
  const rowB = admin.locator(".user-row").filter({ has: admin.getByRole("heading", { name: "TOCA E2E B", exact: true }) });
  await rowB.getByRole("button", { name: "Desactivar cuenta", exact: true }).click();
  await rowB.getByRole("button", { name: "Reactivar cuenta", exact: true }).waitFor();
  check("Desactivar la cuenta pausa todos sus NFC", !ownerB.is_active && !tag.is_active);
  await newOwner.goto(`${origin}/panel`);
  check("Una sesión existente de usuario desactivado queda bloqueada", newOwner.url().includes("/ingresar"));
  await rowB.getByRole("button", { name: "Reactivar cuenta", exact: true }).click();
  await rowB.getByRole("button", { name: "Desactivar cuenta", exact: true }).waitFor();
  check("Reactivar la cuenta no reactiva las etiquetas", ownerB.is_active && !tag.is_active);
  const malformed = await context.request.get(`${origin}/t/incorrecto!`, { maxRedirects: 0 });
  check("Los slugs inválidos fallan sin caché", malformed.status() === 302 && malformed.headers()["cache-control"].includes("no-store"));
  await admin.goto(`${origin}/panel`);
  await mkdir(".impeccable/review", { recursive: true });
  await admin.screenshot({ path: ".impeccable/review/desktop.png", fullPage: true });
  await newOwner.goto(`${origin}/panel`);
  await newOwner.screenshot({ path: ".impeccable/review/mobile.png", fullPage: true });
  const overflow = await newOwner.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check("El panel móvil no tiene desbordamiento horizontal", !overflow);
  check("El navegador no reportó errores JavaScript", consoleErrors.length === 0);
  check("El navegador no intentó contactar servicios externos", externalRequests.length === 0);
  console.log(`\n${checks.length} comprobaciones E2E pasaron. Supabase simulado; RLS real pendiente de validación.`);
} catch (error) {
  console.error(error.message);
  if (browser) { const page = browser.contexts()[0]?.pages()[0]; if (page) console.error((await page.locator("body").innerText()).slice(-1500)); }
  console.error("Últimas solicitudes del fixture:", fixture.requests.slice(-15));
  console.error(logs.slice(-5000)); process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  dev.kill("SIGTERM");
  if (dev.exitCode === null) await once(dev, "exit");
  await new Promise(resolve => fixture.server.close(resolve));
}
