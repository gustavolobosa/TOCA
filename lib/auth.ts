import "server-only";

import { cache } from "react";
import { notFound, redirect } from "next/navigation";

import { isAdminUser } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export const getAccount = cache(async function getAccount() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  const { data, error } = await supabase.from("profiles")
    .select("id,name,email,is_active,is_admin,must_change_password,created_at,token_valid_after")
    .eq("id", user.id).maybeSingle();
  if (error) throw new Error("No pudimos verificar el acceso. Comprueba que la migración esté aplicada.");
  if (!data) return null;
  const profile = data as Profile;
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims || claims.claims.iat < profile.token_valid_after) return null;
  return { supabase, user, profile, isAdmin: profile.is_admin && isAdminUser(user.id) };
});

export const requireAccount = cache(async function requireAccount() {
  const account = await getAccount();
  if (!account) redirect("/ingresar");
  if (!account.profile.is_active) redirect("/ingresar?error=Tu+cuenta+está+desactivada.+Contacta+al+administrador.");
  return account;
});

export const requirePanelAccount = cache(async function requirePanelAccount() {
  const account = await requireAccount();
  if (account.profile.must_change_password) redirect("/cuenta/clave");
  if (account.isAdmin) {
    // getUser verificó la identidad; AAL y factores deben coincidir, no solo un JWT viejo.
    const { data, error } = await account.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || data?.currentLevel !== "aal2" || !account.user.factors?.some(factor => factor.status === "verified" && factor.factor_type === "totp")) redirect("/cuenta/seguridad");
  }
  return account;
});

export const requireAdmin = cache(async function requireAdmin() {
  const account = await requirePanelAccount();
  if (!account.isAdmin) notFound();
  return account;
});
