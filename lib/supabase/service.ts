import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getServiceSupabaseEnv } from "@/lib/env";

export function createSupabaseServiceClient() {
  const { url, secretKey } = getServiceSupabaseEnv();

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
