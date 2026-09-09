import { cache } from "react";
import { redirect } from "next/navigation";

import { getAdminEmail } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const requireAdmin = cache(async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.email?.toLowerCase() !== getAdminEmail()) {
    redirect("/ingresar");
  }

  return { supabase, user };
});
