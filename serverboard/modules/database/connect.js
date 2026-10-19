import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to load .env without hard dependency on external packages
function loadEnv() {
  const envPaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, "../../../.env"),
    path.resolve(__dirname, "../../.env"),
  ];

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, "utf8");
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, "");
            if (process.env[key] === undefined) {
              process.env[key] = val;
            }
          }
        }
      } catch {
        /* ignore */
      }
    }
  }
}

loadEnv();

let cachedClient = null;

/**
 * Resolves Supabase credentials from environment variables.
 */
export function getSupabaseConfig() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    null;

  const key =
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    null;

  return { url, key };
}

/**
 * Creates a new Supabase client instance.
 *
 * @param {Object} [options={}]
 * @param {string} [options.url] - Optional Supabase URL override
 * @param {string} [options.key] - Optional Supabase API key override
 * @param {Object} [options.clientOptions] - Custom options passed to createClient
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createSupabaseClient(options = {}) {
  const { url: defaultUrl, key: defaultKey } = getSupabaseConfig();
  const url = options.url || defaultUrl;
  const key = options.key || defaultKey;

  if (!url || !key) {
    throw new Error(
      "Supabase configuration missing: SUPABASE_URL and SUPABASE_KEY must be set in .env or environment"
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
    ...options.clientOptions,
  });
}

/**
 * Returns a shared singleton Supabase client.
 *
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function getSupabaseClient() {
  if (!cachedClient) {
    cachedClient = createSupabaseClient();
  }
  return cachedClient;
}

/**
 * Tests database connectivity and measures response latency.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} [client] - Optional client to test
 * @returns {Promise<{ ok: boolean, latencyMs: number, error?: string }>}
 */
export async function testConnection(client = getSupabaseClient()) {
  const startTime = Date.now();
  try {
    // Perform a lightweight query to verify connectivity
    const { error } = await client.from("latch_locks").select("id").limit(1);
    const latencyMs = Date.now() - startTime;

    if (error && error.code !== "PGRST116") {
      // If table doesn't exist, try another simple ping query
      const ping = await client.auth.getSession();
      if (ping.error) {
        return { ok: false, latencyMs, error: error.message };
      }
    }

    return { ok: true, latencyMs };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - startTime, error: err.message };
  }
}

// Default export: singleton client proxy
export const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getSupabaseClient();
      const value = client[prop];
      return typeof value === "function" ? value.bind(client) : value;
    },
  }
);

export default supabase;

// Execute when run directly: `node serverboard/modules/database/connect.js`
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith("/database/connect.js") ||
    process.argv[1].endsWith("\\database\\connect.js"));

if (isDirectRun) {
  console.log("Connecting to Supabase...");
  const config = getSupabaseConfig();
  console.log(`URL: ${config.url || "[NOT SET]"}`);
  console.log(`Key: ${config.key ? config.key.slice(0, 15) + "..." : "[NOT SET]"}`);

  try {
    const result = await testConnection();
    if (result.ok) {
      console.log(`✔ Connected to Supabase successfully in ${result.latencyMs}ms`);
    } else {
      console.error(`✖ Connection check failed (${result.latencyMs}ms):`, result.error);
      process.exit(1);
    }
  } catch (err) {
    console.error("✖ Fatal error connecting to Supabase:", err.message);
    process.exit(1);
  }
}
