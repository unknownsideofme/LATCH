import { createClient } from "@supabase/supabase-js";
import { config } from "./env.js";

if (!config.supabase.url || !config.supabase.key) {
  console.warn("[supabase] Warning: SUPABASE_URL or SUPABASE_KEY missing in environment");
}

export const supabase = createClient(
  config.supabase.url || "https://placeholder.supabase.co",
  config.supabase.key || "placeholder-key",
  {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${config.supabase.key}`,
      },
    },
  }
);

export async function checkDbHealth() {
  const start = Date.now();
  try {
    const { error: tableError } = await supabase.from("users").select("id").limit(1);
    const latencyMs = Date.now() - start;

    // Missing tables/columns can be resolved by applying the schema migration.
    const schemaError = tableError && ["42P01", "42703", "PGRST204", "PGRST205"].includes(tableError.code);
    if (tableError && !schemaError) {
      return { ok: false, latencyMs, error: tableError.message };
    }

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
