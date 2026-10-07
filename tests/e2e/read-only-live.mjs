import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";

// Servidor real ya iniciado; no inicia fixtures ni envía formularios a Supabase.
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require("playwright"); }
catch { playwright = require(process.env.TOCA_PLAYWRIGHT_PATH ?? "/Users/gustavolobos/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"); }
const origin = "http://localhost:3000";
const directory = ".impeccable/review/live";
const results = [], errors = [], blockedRequests = [];
const check = (name, condition) => {
  results.push({ name, passed: Boolean(condition) });
  console.log(`${condition ? "PASS" : "FAIL"} ${name}`);
};
await mkdir(directory, { recursive: true });
const browser = await playwright.chromium.launch({ headless: true, channel: "chrome" });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  await context.route("**/*", route => {
    const request = route.request();
    if (!['GET', 'HEAD'].includes(request.method()) || new URL(request.url()).origin !== origin) {
      blockedRequests.push({ method: request.method(), url: request.url() });
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  let response = await page.goto(`${origin}/`, { waitUntil: "networkidle" });
  check("Inicio anónimo termina en login real (HTTP 200)", response.status() === 200 && new URL(page.url()).pathname === "/ingresar");
  check("Login tiene los campos y botón esperados", await page.getByLabel("Correo", { exact: true }).count() === 1 && await page.getByLabel("Contraseña", { exact: true }).count() === 1 && await page.getByRole("button", { name: "Entrar", exact: true }).count() === 1);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  check("Campos obligatorios impiden enviar un formulario vacío", await page.locator("form").evaluate(form => !form.checkValidity()) && blockedRequests.length === 0);
  await page.getByLabel("Correo", { exact: true }).fill("correo-invalido");
  check("El navegador rechaza un correo mal formado", await page.getByLabel("Correo", { exact: true }).evaluate(input => input.validity.typeMismatch));
  await page.getByLabel("Correo", { exact: true }).fill("");
  await page.screenshot({ path: `${directory}/login-desktop.png`, fullPage: true });
  for (const path of ["/panel", "/panel/nuevo", "/panel/usuarios", "/cuenta/clave", "/cuenta/seguridad"]) {
    const privateResponse = await context.request.get(`${origin}${path}`, { maxRedirects: 0 });
    check(`Anónimo no accede a ${path}`, privateResponse.status() === 307 && new URL(privateResponse.headers().location, origin).pathname === "/ingresar");
    check(`${path} no se almacena en caché`, /no-store|no-cache/.test(privateResponse.headers()["cache-control"] ?? ""));
  }
  check("Cabeceras contra iframes y detección de contenido presentes", response.headers()["x-frame-options"] === "DENY" && response.headers()["x-content-type-options"] === "nosniff");
  // Slug deliberadamente inválido: la ruta no invoca resolve_nfc ni registra visitas.
  response = await page.goto(`${origin}/t/x`, { waitUntil: "networkidle" });
  check("Un slug inválido muestra el aviso sin registrar visitas", response.status() === 200 && new URL(page.url()).pathname === "/enlace-no-disponible" && await page.getByRole("heading", { name: "Este enlace no está disponible" }).count() === 1);
  await page.screenshot({ path: `${directory}/enlace-no-disponible.png`, fullPage: true });
  response = await page.goto(`${origin}/ruta-qa-inexistente`, { waitUntil: "networkidle" });
  check("Una ruta inexistente devuelve HTTP 404", response.status() === 404);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/ingresar`, { waitUntil: "networkidle" });
  check("Login móvil sin desborde horizontal", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  check("Botón Entrar visible en móvil", await page.getByRole("button", { name: "Entrar", exact: true }).isVisible());
  await page.screenshot({ path: `${directory}/login-mobile.png`, fullPage: true });
  check("Las páginas públicas no generan errores JavaScript", errors.length === 0);
  check("No se intentaron escrituras ni peticiones externas desde el navegador", blockedRequests.length === 0);
  await writeFile(`${directory}/anonymous-results.json`, JSON.stringify({ origin, mode: "real-server-anonymous-read-only", results, errors, blockedRequests, notTested: ["Login con credenciales", "Panel autenticado", "CRUD de usuarios/NFC", "RLS entre propietarios", "Redirecciones NFC válidas e historial"] }, null, 2));
  assert.ok(results.every(result => result.passed), "Hay comprobaciones reales fallidas; revisa anonymous-results.json.");
} finally { await browser.close(); }
