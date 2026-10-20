import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Auto-load .env from root or serverboard only if not already set by system/container
for (const p of [path.resolve(process.cwd(), ".env"), path.resolve(__dirname, "../../.env")]) {
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const match = line.trim().match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        if (process.env[key] === undefined) {
          process.env[key] = match[2].trim().replace(/^['"]|['"]$/g, "");
        }
      }
    }
  }
}

// Environment type: 'dev' | 'test' | 'prod'
const envType = (process.env.ENV_TYPE || process.env.NODE_ENV || "dev").toLowerCase();
const isProd = envType === "prod" || envType === "production";
const isDev = envType === "dev" || envType === "development";
const isTest = envType === "test";

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || null;
const anonKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || null;

// Fail fast in production if required secrets are missing
if (isProd) {
  if (!process.env.INNGEST_SIGNING_KEY) {
    throw new Error("Security Error: INNGEST_SIGNING_KEY is required in production mode");
  }
  if (!serviceRoleKey) {
    throw new Error("Security Error: SUPABASE_SERVICE_ROLE (service-role key) is required in production mode");
  }
}

export const config = {
  envType,
  isProd,
  isDev,
  isTest,
  allowDevAuth: isDev && process.env.ALLOW_DEV_AUTH === "1",
  port: Number(process.env.PORT || process.env.SERVERBOARD_PORT || 4000),
  corsOrigins: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map(o => o.trim())
    : ["http://localhost:3000", "http://localhost:3002", "http://localhost:4000", "http://127.0.0.1:3002"],
  supabase: {
    url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: serviceRoleKey || anonKey,
    anonKey: anonKey || serviceRoleKey,
    key: serviceRoleKey || anonKey,
  },
  inngest: {
    eventKey: process.env.INNGEST_EVENT_KEY,
    signingKey: process.env.INNGEST_SIGNING_KEY,
    isDev: isDev,
  },
  webhookSecret: process.env.RENDER_WEBHOOK_SECRET,
};
