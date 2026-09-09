function required(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Falta configurar ${name}. Revisa .env.local.`);
  }

  return value;
}

export function getPublicSupabaseEnv() {
  return {
    url: required(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    publishableKey: required(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  };
}

export function getServiceSupabaseEnv() {
  return {
    url: required("SUPABASE_URL", process.env.SUPABASE_URL),
    secretKey: required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY),
  };
}

export function getAdminEmail() {
  return required("ADMIN_EMAIL", process.env.ADMIN_EMAIL).toLowerCase();
}

export function getSiteUrl() {
  return required("NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL).replace(
    /\/$/,
    "",
  );
}
