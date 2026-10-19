import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Auto-load .env from root or serverboard
for (const p of [path.resolve(process.cwd(), ".env"), path.resolve(__dirname, "../../.env")]) {
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const match = line.trim().match(/^([^#=]+)=(.*)$/);
      if (match && process.env[match[1].trim()] === undefined) {
        process.env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, "");
      }
    }
  }
}

if (!process.env.INNGEST_SIGNING_KEY && process.env.NODE_ENV !== "production") {
  process.env.INNGEST_DEV = "1";
}

export const config = {
  port: Number(process.env.PORT || process.env.SERVERBOARD_PORT || 4000),
  supabase: {
    url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
  inngest: {
    eventKey: process.env.INNGEST_EVENT_KEY,
    signingKey: process.env.INNGEST_SIGNING_KEY,
    isDev: process.env.INNGEST_DEV === "1" || !process.env.INNGEST_SIGNING_KEY,
  },
  webhookSecret: process.env.RENDER_WEBHOOK_SECRET,
};
