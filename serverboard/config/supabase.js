import { createClient } from "@supabase/supabase-js";
import { config } from "./env.js";

if (!config.supabase.url || !config.supabase.key) {
  console.warn("[supabase] Warning: SUPABASE_URL or SUPABASE_KEY missing in environment");
}

export const supabase = createClient(
  config.supabase.url || "https://placeholder.supabase.co",
  config.supabase.key || "placeholder-key",
  { auth: { persistSession: false } }
);

export async function checkDbHealth() {
  const start = Date.now();
  try {
    const { error: authError } = await supabase.auth.getSession();
    const latencyMs = Date.now() - start;

    if (authError) {
      return { ok: false, latencyMs, error: authError.message };
    }

    const { error: tableError } = await supabase.from("users").select("id").limit(1);

    return {
      ok: true,
      latencyMs,
      tablesReady: !tableError,
      status: tableError ? "connected (tables pending schema migration)" : "connected",
    };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: err.message };
  }
}
