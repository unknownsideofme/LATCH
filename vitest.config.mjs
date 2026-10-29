import { defineConfig } from "vitest/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverboardModules = path.resolve(__dirname, "serverboard/node_modules");
const hasServerboardModules = fs.existsSync(serverboardModules);

export default defineConfig({
  resolve: {
    alias: hasServerboardModules
      ? {
          "inngest/express": path.resolve(serverboardModules, "inngest/express.js"),
          "inngest": path.resolve(serverboardModules, "inngest/index.js"),
          "@supabase/supabase-js": path.resolve(serverboardModules, "@supabase/supabase-js/dist/index.mjs"),
        }
      : {},
  },
  test: {
    globals: true,
    include: ["tests/**/*.test.js"],
    coverage: {
      provider: "v8",
    },
  },
});
