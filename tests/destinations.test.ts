import assert from "node:assert/strict";
import { test } from "node:test";
import { destinationInput, destinationLabel, parseDestination } from "../lib/destinations.ts";
import { parseHttpsUrl, parseName } from "../lib/urls.ts";
import { parseEmail, parseId, parsePassword, parseUserId, parsePage } from "../lib/validation.ts";

test("Instagram normaliza el usuario y no acepta una URL disfrazada", () => {
  assert.deepEqual(parseDestination("instagram", " @Mi.Negocio "), { destination_type: "instagram", destination_url: "https://www.instagram.com/mi.negocio/" });
  for (const value of ["https://evil.com", "../otro", "a?next=evil", "@a/b", "dos..puntos", ".inicio", "fin.", "a".repeat(31), "@@nombre", ""]) assert.throws(() => parseDestination("instagram", value));
});

test("WhatsApp normaliza el número sin aceptar texto, extensiones o números demasiado cortos", () => {
  assert.equal(parseDestination("whatsapp", "+56 (9) 1234-5678").destination_url, "https://wa.me/56912345678");
  for (const value of ["1234", "056912345678", "numero 56912345678", "56912345678 ext 1", "1".repeat(16), "https://wa.me/56912345678"]) assert.throws(() => parseDestination("whatsapp", value));
});

test("Google solo acepta enlaces explícitos para solicitar reseñas", () => {
  for (const value of ["https://g.page/r/AbC_123/review", "https://g.page/negocio/review?rc", "https://search.google.com/local/writereview?placeid=ChIJ_1234"]) assert.equal(parseDestination("google_review", value).destination_url, value);
  for (const value of ["https://g.page.evil.com/r/id/review", "https://evil.com/review", "https://www.google.com/maps/place/negocio", "https://g.page/r/id", "https://search.google.com/local/writereview", "https://g.page/r/id/review#fragment"]) assert.throws(() => parseDestination("google_review", value));
});

test("los destinos genéricos rechazan redes privadas, credenciales, protocolos y bucles", () => {
  assert.equal(parseHttpsUrl("https://ejemplo.cl/menu?q=uno%20dos#carta"), "https://ejemplo.cl/menu?q=uno%20dos#carta");
  assert.equal(parseHttpsUrl("https://mañana.cl/"), "https://xn--maana-pta.cl/");
  for (const value of ["http://example.com", "javascript:alert(1)", "data:text/html,test", "https://user:pass@example.com", "https://localhost", "https://127.0.0.1", "https://2130706433", "https://192.168.1.1", "https://[::1]", "https://host.local", "https://host.internal", "https://example.com:8443", "https://toca-one.vercel.app/t/slug1234", "https://example.com/\r\nLocation:evil"]) assert.throws(() => parseHttpsUrl(value));
  assert.throws(() => parseHttpsUrl("https://nuevo-toca.cl/t/slug1234", "https://nuevo-toca.cl"));
  assert.throws(() => parseHttpsUrl("https://example.com/" + "a".repeat(2048)));
});

test("el editor recupera el campo correcto y el histórico conserva tipos desconocidos", () => {
  assert.equal(destinationInput("instagram", "https://www.instagram.com/negocio/"), "negocio");
  assert.equal(destinationInput("whatsapp", "https://wa.me/56912345678"), "56912345678");
  assert.equal(destinationLabel("unknown"), "Sin clasificar");
  assert.throws(() => parseDestination("otro", "https://example.com"));
});

test("los datos de cuentas, identificadores y páginas se validan en el servidor", () => {
  assert.equal(parseEmail(" CLIENTE@example.com "), "cliente@example.com");
  assert.equal(parseName(" Mesa 1 "), "Mesa 1");
  assert.equal(parsePassword("frase larga exclusiva"), "frase larga exclusiva");
  assert.throws(() => parsePassword("toca123"));
  assert.throws(() => parseEmail("mal@correo"));
  assert.throws(() => parseName(" "));
  assert.equal(parseId("12"), 12);
  for (const id of [0, -1, NaN, Infinity, "1e2", "1.0", "1 OR 1=1", Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => parseId(id));
  assert.equal(parseUserId("C8A7CE34-CA9C-4D20-B7D3-60279ADC9812"), "c8a7ce34-ca9c-4d20-b7d3-60279adc9812");
  assert.throws(() => parseUserId("admin"));
  assert.equal(parsePage(undefined), 0);
  assert.equal(parsePage("2"), 2);
  for (const page of ["-1", "1e2", "10001", "NaN"]) assert.throws(() => parsePage(page));
});
