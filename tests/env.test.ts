import assert from "node:assert/strict";
import { test } from "node:test";
import { getAdminUserId, getPublicSupabaseEnv, getServiceSupabaseEnv, getSiteUrl, isAdminUser } from "../lib/env.ts";

const admin = "c8a7ce34-ca9c-4d20-b7d3-60279adc9812";

function withEnv(values: Record<string, string | undefined>, check: () => void) {
  const before = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    check();
  } finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("solo el ID fijo otorga permisos; el correo no es autoridad", () => {
  withEnv({ ADMIN_USER_ID: admin, ADMIN_EMAIL: "otro@example.com" }, () => {
    assert.equal(isAdminUser(admin), true);
    assert.equal(isAdminUser("d8a7ce34-ca9c-4d20-b7d3-60279adc9812"), false);
    assert.equal(isAdminUser(undefined), false);
    assert.equal(isAdminUser(null), false);
  });
});

test("la configuración administrativa ausente o inválida falla de forma segura", () => {
  for (const id of [undefined, "", "   ", "correo@example.com", "uuid-del-administrador"]) {
    withEnv({ ADMIN_USER_ID: id }, () => assert.throws(() => getAdminUserId(), /ADMIN_USER_ID/));
  }
});

test("normaliza el origen del sitio y permite localhost únicamente en desarrollo", () => {
  withEnv({ NODE_ENV: "development", VERCEL_ENV: undefined, NEXT_PUBLIC_SITE_URL: " http://localhost:3000/ " }, () => {
    assert.equal(getSiteUrl(), "http://localhost:3000");
  });
  for (const mode of [{ NODE_ENV: "production", VERCEL_ENV: undefined }, { NODE_ENV: "development", VERCEL_ENV: "preview" }]) {
    withEnv({ ...mode, NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }, () => assert.throws(() => getSiteUrl(), /HTTPS/));
  }
  withEnv({ NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://toca-one.vercel.app/" }, () => {
    assert.equal(getSiteUrl(), "https://toca-one.vercel.app");
  });
});

test("rechaza sitios con rutas, credenciales, protocolos inseguros y parámetros", () => {
  for (const value of ["https://example.com/panel", "https://user:secret@example.com", "https://example.com?next=evil", "https://example.com#secret", "http://example.com", "javascript:alert(1)", "not-a-url", "https://localhost"]) {
    withEnv({ NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: value }, () => assert.throws(() => getSiteUrl(), /NEXT_PUBLIC_SITE_URL/));
  }
});

test("el cliente público no devuelve la clave secreta", () => {
  withEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-key", SUPABASE_SECRET_KEY: "secret-test-value" }, () => {
    assert.deepEqual(getPublicSupabaseEnv(), { url: "https://project.supabase.co", publishableKey: "public-key" });
  });
});

test("rechaza una clave secreta configurada por error como pública", () => {
  withEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_test-value" }, () => {
    assert.throws(() => getPublicSupabaseEnv(), error => error instanceof Error && error.message.includes("clave pública") && !error.message.includes("test-value"));
  });
});

test("el servidor y el navegador deben apuntar al mismo proyecto", () => {
  const base = { NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-key", SUPABASE_SECRET_KEY: "secret-test-value" };
  withEnv({ ...base, SUPABASE_URL: "https://other.supabase.co" }, () => assert.throws(() => getServiceSupabaseEnv(), /mismo proyecto/));
  withEnv({ ...base, SUPABASE_URL: "https://project.supabase.co/" }, () => assert.deepEqual(getServiceSupabaseEnv(), { url: "https://project.supabase.co", secretKey: "secret-test-value" }));
});

test("los errores de configuración no revelan los valores", () => {
  withEnv({ NEXT_PUBLIC_SITE_URL: "https://user:super-secret@example.com" }, () => {
    assert.throws(() => getSiteUrl(), error => error instanceof Error && !error.message.includes("super-secret"));
  });
});
