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
  await login(admin, "admin@example.com", "FraseAdminNueva2026!solo");
  await admin.goto(`${origin}/cuenta/seguridad`);
  check("El administrador entra sin MFA y la ruta antigua vuelve al panel", admin.url().endsWith("/panel") && !fixture.requests.some(request => request.path.includes("/factors")));
  await admin.goto(`${origin}/cuenta/clave`);
  const withoutCode = await admin.locator('input[name="code"]').count() === 0;
  await changePassword(admin, "FraseAdminNueva2026!solo", "OtraFraseAdmin2026!solo");
  await login(admin, "admin@example.com", "OtraFraseAdmin2026!solo");
  check("El administrador cambia su contraseña sin código y vuelve a entrar", withoutCode && admin.url().endsWith("/panel"));
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
  check("El historial del administrador no ofrece reasignación", await admin.getByLabel("Nuevo propietario", { exact: true }).count() === 0 && await admin.getByRole("button", { name: "Reasignar y pausar NFC" }).count() === 0 && tag.owner_id === ownerA.id);
  await customer.goto(`${origin}/panel`);
  await customer.getByRole("button", { name: "Acciones de Mostrador E2E", exact: true }).click();
  await customer.getByRole("button", { name: "Pausar NFC", exact: true }).click();
  await customer.getByRole("button", { name: "Activar NFC", exact: true }).waitFor();
  const paused = await context.request.get(`${origin}/t/${stableSlug}`, { maxRedirects: 0 });
  check("Un NFC pausado no registra ni redirige al destino", paused.headers().location.endsWith("/enlace-no-disponible") && fixture.events.length === 3);
  const otherContext = await createContext({ viewport: { width: 390, height: 844 } }); const otherUser = await otherContext.newPage();
  await login(otherUser, ownerB.email, passwordB, "/cuenta/clave");
  await changePassword(otherUser, passwordB, "OtraFraseCliente2026!solo");
  await login(otherUser, ownerB.email, "OtraFraseCliente2026!solo");
  const deniedEdit = await otherUser.goto(`${origin}/panel/${tag.id}/editar`);
  const deniedHistory = await otherUser.goto(`${origin}/panel/${tag.id}`);
  check("Otro usuario no puede editar ni consultar el historial ajeno", deniedEdit.status() === 404 && deniedHistory.status() === 404);
  const deniedInlineHistory = await otherContext.request.get(`${origin}/panel/${tag.id}/historial`);
  check("El historial desplegable también protege los NFC ajenos", deniedInlineHistory.status() === 404);
  await customer.goto(`${origin}/panel`);
  await customer.getByRole("button", { name: "Mostrador E2E", exact: true }).click();
  check("El usuario despliega el destino completo y el enlace estable", await customer.locator(".stable-link").innerText().then(text => text.includes(stableSlug)));
  await customer.getByRole("button", { name: "Historial", exact: true }).click();
  await customer.locator(".inline-history").waitFor();
  check("El historial se consulta dentro del panel sin perder destinos anteriores", (await customer.locator(".inline-history").innerText()).includes("https://wa.me/56912345678") && new URL(customer.url()).pathname === "/panel");
  const inlineResponse = await customerContext.request.get(`${origin}/panel/${tag.id}/historial`);
  check("El historial privado no se almacena en caché", inlineResponse.status() === 200 && inlineResponse.headers()["cache-control"].includes("no-store"));
  await customer.goto(`${origin}/panel/${tag.id}`);
  check("El propietario conserva todos los destinos anteriores", (await customer.locator("body").textContent()).includes("https://wa.me/56912345678"));
  await edit(customer, tag.id, "instagram", "negocio_nuevo");
  await admin.goto(`${origin}/panel/usuarios`);
  const rowA = admin.locator(".user-row").filter({ has: admin.getByRole("heading", { name: "TOCA E2E A", exact: true }) });
  await rowA.getByRole("button", { name: "Desactivar cuenta", exact: true }).click();
  await rowA.getByRole("button", { name: "Reactivar cuenta", exact: true }).waitFor();
  check("Desactivar la cuenta pausa todos sus NFC", !ownerA.is_active && !tag.is_active);
  await customer.goto(`${origin}/panel`);
  check("Una sesión existente de usuario desactivado queda bloqueada", customer.url().includes("/ingresar"));
  await rowA.getByRole("button", { name: "Reactivar cuenta", exact: true }).click();
  await rowA.getByRole("button", { name: "Desactivar cuenta", exact: true }).waitFor();
  check("Reactivar la cuenta no reactiva las etiquetas", ownerA.is_active && !tag.is_active);
  const malformed = await context.request.get(`${origin}/t/incorrecto!`, { maxRedirects: 0 });
  check("Los slugs inválidos fallan sin caché", malformed.status() === 302 && malformed.headers()["cache-control"].includes("no-store"));
  await admin.goto(`${origin}/panel`);
  await admin.getByRole("button", { name: "Copiar enlace NFC", exact: true }).click();
  check("Copiar entrega el enlace de TOCA, no el destino final", await admin.evaluate(() => navigator.clipboard.readText()) === `${origin}/t/${stableSlug}`);
  await admin.getByRole("button", { name: "Acciones de Mostrador E2E", exact: true }).click();
  await admin.keyboard.press("Escape");
  check("Escape cierra el menú y devuelve el foco al botón", await admin.getByRole("button", { name: "Acciones de Mostrador E2E", exact: true }).evaluate(button => document.activeElement === button && button.getAttribute("aria-expanded") === "false"));
  await admin.getByLabel("Destino de la visita", { exact: true }).selectOption("whatsapp");
  await admin.waitForURL(/type=whatsapp/);
  await admin.getByLabel("Destino de la visita", { exact: true }).waitFor({ state: "visible" });
  check("El filtro histórico conserva el NFC aunque ahora apunte a Instagram", await admin.locator(".nfc-item").count() === 1 && (await admin.locator(".nfc-destination").innerText()).includes("negocio_nuevo") && (await admin.locator(".nfc-visits").innerText()).trim() === "1" && (await admin.locator(".traffic-summary").innerText()).includes("1 visita"));
  await admin.getByRole("button", { name: "Por destino", exact: true }).click();
  await admin.waitForURL(/group=destination/);
  await admin.locator(".traffic-plot").focus();
  await admin.keyboard.press("End");
  check("El gráfico conserva el detalle accesible por teclado", await admin.locator("#traffic-day-detail").isVisible() && (await admin.locator("#traffic-day-detail").innerText()).includes("WhatsApp"));
  await admin.getByLabel("Destino de la visita", { exact: true }).selectOption("unknown");
  await admin.waitForURL(/type=unknown/);
  check("Un destino sin visitas muestra cero y una lista vacía", await admin.locator(".nfc-item").count() === 0 && (await admin.locator(".traffic-summary").innerText()).includes("0 visitas"));
  await admin.getByRole("link", { name: "Restablecer filtros", exact: true }).click();
  await admin.waitForURL(`${origin}/panel`);
  for (const width of [1440, 1280, 1180, 1050, 1024, 760, 390, 320]) {
    await admin.setViewportSize({ width, height: 1000 });
    check(`El panel no desborda a ${width}px`, await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  await admin.setViewportSize({ width: 1440, height: 1000 });
  check("El primer NFC es visible en la pantalla inicial", await admin.locator(".nfc-item").first().evaluate(element => element.getBoundingClientRect().bottom < innerHeight));
  // Datos adicionales solo en memoria para comprobar distribución, filtros y estados.
  tag.is_active = true;
  for (const [index, name, owner, kind, url] of [
    [2, "Recepción", ownerB.id, "whatsapp", "https://wa.me/56912345678"],
    [3, "Terraza", ownerA.id, "generic", "https://example.com/menu"],
  ]) {
    fixture.links.push({ ...tag, id: index, name, owner_id: owner, slug: `fixture_tag_${index}`, destination_type: kind, destination_url: url });
    fixture.history.push({ id: fixture.history.length + 1, nfc_link_id: index, destination_type: kind, destination_url: url, created_at: new Date().toISOString() });
    for (let day = 0; day < 6; day++) fixture.events.push({ id: fixture.events.length + 1, nfc_link_id: index, destination_type: kind, destination_url: url, created_at: new Date(Date.now() - day * 86400000).toISOString() });
  }
  fixture.events.push({ id: fixture.events.length + 1, nfc_link_id: 3, destination_type: "generic", destination_url: "https://example.com/menu", created_at: new Date(Date.now() - 45 * 86400000).toISOString() });
  fixture.events.push({ id: fixture.events.length + 1, nfc_link_id: 3, destination_type: "generic", destination_url: "https://example.com/menu", created_at: new Date(Date.now() + 3 * 86400000).toISOString() });
  await admin.goto(`${origin}/panel`, { waitUntil: "networkidle" });
  check("El período excluye visitas futuras y anteriores a sus 30 días", (await admin.locator(".traffic-summary > p").innerText()) === "15 visitas");
  await admin.getByLabel("Período", { exact: true }).selectOption("90");
  await admin.waitForURL(/days=90/);
  check("90 días incluye visitas anteriores sin incorporar las futuras", (await admin.locator(".traffic-summary > p").innerText()) === "16 visitas");
  await admin.getByRole("combobox", { name: "NFC", exact: true }).selectOption("3");
  await admin.waitForURL(/nfc=3/);
  check("El filtro individual actualiza a la vez lista y gráfico", await admin.locator(".nfc-item").count() === 1 && (await admin.locator(".traffic-summary > p").innerText()) === "7 visitas" && (await admin.locator(".nfc-visits").innerText()).trim() === "7");
  await admin.goto(`${origin}/panel`, { waitUntil: "networkidle" });
  await admin.getByRole("button", { name: "Acciones de Mostrador E2E", exact: true }).click();
  fixture.failures.set("/rest/v1/rpc/update_nfc", 1);
  await admin.getByRole("button", { name: "Pausar NFC", exact: true }).click();
  await admin.getByRole("alert").filter({ hasText: "No pudimos cambiar el estado" }).waitFor();
  check("Un fallo al pausar conserva el estado y permite reintentar", tag.is_active && await admin.getByRole("button", { name: "Pausar NFC", exact: true }).isEnabled());
  await admin.route(`${origin}/panel`, async route => { if (route.request().method() === "POST") await sleep(900); await route.continue(); });
  const beforePause = await admin.locator(".nfc-row").first().boundingBox();
  await admin.getByRole("button", { name: "Pausar NFC", exact: true }).click();
  await admin.locator('.menu-content button[aria-busy="true"]').waitFor();
  const duringPause = await admin.locator(".nfc-row").first().boundingBox();
  check("Pausar con red lenta bloquea doble envío y mantiene el tamaño de la fila", await admin.getByRole("button", { name: "Pausar NFC", exact: true }).isDisabled() && beforePause.width === duringPause.width && beforePause.height === duringPause.height);
  await admin.getByRole("button", { name: "Activar NFC", exact: true }).waitFor();
  await admin.unroute(`${origin}/panel`);
  await admin.getByRole("button", { name: "Activar NFC", exact: true }).click();
  await admin.getByRole("button", { name: "Pausar NFC", exact: true }).waitFor();
  check("El administrador puede reactivar después de pausar", tag.is_active);
  await admin.keyboard.press("Escape");
  await admin.getByRole("button", { name: /Terraza TOCA E2E A/ }).click();
  await admin.route(`**/panel/3/historial`, route => route.fulfill({ status: 503, contentType: "application/json", body: '{}' }));
  await admin.getByRole("button", { name: "Historial", exact: true }).click();
  await admin.getByRole("button", { name: "Reintentar", exact: true }).waitFor();
  await admin.unroute(`**/panel/3/historial`);
  await admin.getByRole("button", { name: "Reintentar", exact: true }).click();
  await admin.locator(".inline-history").waitFor();
  check("El historial bajo demanda se recupera de un fallo de red", (await admin.locator(".inline-history").innerText()).includes("https://example.com/menu"));
  await admin.getByRole("button", { name: "Destino", exact: true }).click();
  await mkdir(".impeccable/review", { recursive: true });
  await admin.evaluate(() => scrollTo(0, 0));
  await admin.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await admin.screenshot({ path: ".impeccable/review/desktop.png", fullPage: true, style: "nextjs-portal { visibility: hidden; }" });
  await customer.goto(`${origin}/panel`, { waitUntil: "networkidle" });
  check("El propietario ve solo sus dos NFC, sin controles de administración", await customer.locator(".nfc-item").count() === 2 && await customer.getByRole("link", { name: "Agregar NFC", exact: true }).count() === 0 && await customer.getByRole("link", { name: "Usuarios", exact: true }).count() === 0 && await customer.getByRole("heading", { name: "Recepción", exact: true }).count() === 0);
  await customer.setViewportSize({ width: 1440, height: 1000 });
  await customer.reload({ waitUntil: "networkidle" });
  await customer.screenshot({ path: ".impeccable/review/user-desktop.png", fullPage: true, style: "nextjs-portal { visibility: hidden; }" });
  await customer.setViewportSize({ width: 390, height: 844 });
  await customer.reload({ waitUntil: "networkidle" });
  await customer.getByRole("button", { name: "Terraza", exact: true }).click();
  await customer.screenshot({ path: ".impeccable/review/mobile.png", fullPage: true, style: "nextjs-portal { visibility: hidden; }" });
  const overflow = await customer.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check("El panel móvil no tiene desbordamiento horizontal", !overflow);
  await customer.evaluate(() => Object.defineProperty(navigator.clipboard, "writeText", { configurable: true, value: async () => { throw new DOMException("Permiso denegado", "NotAllowedError"); } }));
  await customer.getByRole("button", { name: "Copiar enlace NFC", exact: true }).first().click();
  await customer.locator(".copy-error").waitFor();
  check("El aviso de fallo del portapapeles permanece completo dentro del móvil", await customer.locator(".copy-error").evaluate(element => { const box = element.getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth; }));
  await customer.screenshot({ path: ".impeccable/review/copy-error-mobile.png", fullPage: true, style: "nextjs-portal { visibility: hidden; }" });
  const foreignFilter = await customer.goto(`${origin}/panel?nfc=2`);
  check("Un propietario no puede filtrar un NFC ajeno por su ID", foreignFilter.status() === 404);
  const anonymousContext = await createContext();
  check("El historial bajo demanda exige sesión", (await anonymousContext.request.get(`${origin}/panel/1/historial`)).status() === 401);
  ownerB.is_active = false;
  check("El historial bajo demanda bloquea cuentas desactivadas", (await otherContext.request.get(`${origin}/panel/2/historial`)).status() === 401);
  ownerB.is_active = true;
  ownerB.must_change_password = true;
  check("El historial bajo demanda exige reemplazar contraseñas temporales", (await otherContext.request.get(`${origin}/panel/2/historial`)).status() === 401);
  ownerB.must_change_password = false;
  // Agotar también los reintentos automáticos del SDK para simular una caída sostenida.
  fixture.failures.set("/rest/v1/nfc_daily_stats", 10);
  await admin.goto(`${origin}/panel`);
  check("Un error en estadísticas nunca muestra totales parciales ni filas inconsistentes", await admin.getByRole("alert").filter({ hasText: "No pudimos cargar los datos completos" }).count() === 1 && await admin.locator(".nfc-item").count() === 0 && (await admin.locator(".traffic-summary").innerText()).includes("no disponibles"));
  fixture.failures.clear();
  for (let id = 4; id <= 54; id++) {
    fixture.links.push({ ...tag, id, name: `NFC ${String(id).padStart(2, "0")}`, owner_id: adminId, slug: `fixture_tag_${id}` });
    fixture.events.push({ id: fixture.events.length + 1, nfc_link_id: id, destination_type: "instagram", destination_url: tag.destination_url, created_at: new Date().toISOString() });
  }
  await admin.goto(`${origin}/panel?group=nfc`);
  check("Muchos NFC se agrupan sin perder visitas fuera de la primera página", await admin.locator(".nfc-item").count() === 50 && await admin.locator(".traffic-legend li").count() === 6 && (await admin.locator(".traffic-summary > p").innerText()) === "66 visitas" && await admin.locator(".traffic-legend strong").evaluateAll(nodes => nodes.reduce((total, node) => total + Number(node.textContent), 0)) === 66);
  await admin.getByRole("link", { name: "Siguiente", exact: true }).click();
  await admin.waitForURL(/page=1/);
  check("Paginar conserva agrupación, filtros y total del período", await admin.locator(".nfc-item").count() === 4 && new URL(admin.url()).searchParams.get("group") === "nfc" && (await admin.locator(".traffic-summary > p").innerText()) === "66 visitas");
  const invalidGroup = await admin.goto(`${origin}/panel?group=invalid`);
  check("El servidor rechaza agrupaciones inválidas", invalidGroup.status() === 404);
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
