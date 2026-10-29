import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "inngest/express": path.resolve(__dirname, "serverboard/node_modules/inngest/express.js"),
      "inngest": path.resolve(__dirname, "serverboard/node_modules/inngest/index.js"),
      "@supabase/supabase-js": path.resolve(__dirname, "serverboard/node_modules/@supabase/supabase-js/dist/index.mjs"),
    },
  },
  test: {
    globals: true,
    include: ["tests/**/*.test.js"],
    coverage: {
      provider: "v8",
    },
  },
});
