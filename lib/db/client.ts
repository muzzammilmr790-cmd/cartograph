import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { env } from "@/lib/env";

/**
 * Constructs a Supabase database client bound to the current Clerk user token.
 *
 * Session ownership belongs strictly to Clerk (the identity provider).
 * Supabase auth session persistence and auto-refresh are disabled (`persistSession: false`)
 * to prevent double-session conflicts.
 */
export async function createDbClient() {
  const { getToken } = await auth();
  const token = await getToken();

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      global: {
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {},
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}
