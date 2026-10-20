"use strict";

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const WebSocket = require("ws");
const { homeLatchDir } = require("../lib/paths");

let cachedClient = null;
let cachedConfig = null;

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, "");
      env[key] = val;
    }
  }
  return env;
}

function loadSupabaseConfig() {
  if (cachedConfig) return cachedConfig;

  // Try local .env files first
  const rootEnv = parseEnvFile(path.join(process.cwd(), ".env"));
  const parentEnv = parseEnvFile(path.join(__dirname, "..", "..", ".env"));
  const mergedEnv = { ...parentEnv, ...rootEnv, ...process.env };

  let url =
    mergedEnv.SUPABASE_URL ||
    mergedEnv.NEXT_PUBLIC_SUPABASE_URL ||
    null;

  let key =
    mergedEnv.SUPABASE_KEY ||
    mergedEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    mergedEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    mergedEnv.SUPABASE_SERVICE_ROLE_KEY ||
    mergedEnv.SUPABASE_ANON_KEY ||
    null;

  if (!url || !key) {
    try {
      const configPath = path.join(homeLatchDir(), "supabase.json");
      if (fs.existsSync(configPath)) {
        const fileContent = JSON.parse(fs.readFileSync(configPath, "utf8"));
        url = url || fileContent.url || null;
        key = key || fileContent.key || fileContent.anonKey || null;
      }
    } catch {
      /* ignore */
    }
  }

  cachedConfig = { url, key };
  return cachedConfig;
}

function getSupabaseClient() {
  if (cachedClient) return cachedClient;

  const { url, key } = loadSupabaseConfig();
  if (!url || !key) return null;

  try {
    cachedClient = createClient(url, key, {
      auth: { persistSession: false },
      realtime: {
        transport: WebSocket,
        params: {
          eventsPerSecond: 20,
        },
      },
    });
    return cachedClient;
  } catch (err) {
    console.warn(`[latch-supabase] Could not initialize Supabase client: ${err.message || err}`);
    return null;
  }
}

function isSupabaseConfigured() {
  const { url, key } = loadSupabaseConfig();
  return Boolean(url && key);
}

module.exports = {
  getSupabaseClient,
  isSupabaseConfigured,
  loadSupabaseConfig,
};
