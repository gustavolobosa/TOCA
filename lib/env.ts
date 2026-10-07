function required(name: string, value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`Falta configurar ${name}. Revisa las variables del entorno.`);
  }
  return trimmed;
}

function origin(name: string, value: string | undefined) {
  const raw = required(name, value);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${name} debe ser una URL absoluta válida.`);
  }

  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const deployed = process.env.NODE_ENV === "production" ||
    ["production", "preview"].includes(process.env.VERCEL_ENV ?? "");
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && local && !deployed)) ||
      (local && deployed)) {
    throw new Error(`${name} debe ser un origen HTTPS sin rutas ni credenciales. localhost solo se permite en desarrollo.`);
  }
  return url.origin;
}

export function getPublicSupabaseEnv() {
  const publishableKey = required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  if (publishableKey.startsWith("sb_secret_")) {
    throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY debe ser una clave pública, nunca una clave secreta.");
  }
  return {
    url: origin(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    publishableKey,
  };
}

export function getServiceSupabaseEnv() {
  const url = origin("SUPABASE_URL", process.env.SUPABASE_URL);
  if (url !== getPublicSupabaseEnv().url) {
    throw new Error("SUPABASE_URL y NEXT_PUBLIC_SUPABASE_URL deben apuntar al mismo proyecto.");
  }
  return {
    url,
    secretKey: required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY),
  };
}

export function getAdminUserId() {
  const id = required("ADMIN_USER_ID", process.env.ADMIN_USER_ID).toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
    throw new Error("ADMIN_USER_ID debe ser el UUID del administrador en Supabase Auth.");
  }
  return id;
}

export function isAdminUser(userId: string | null | undefined) {
  return typeof userId === "string" && userId === getAdminUserId();
}

export function getSiteUrl() {
  return origin("NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL);
}
