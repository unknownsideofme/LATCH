"use strict";

const fs = require("fs");
const path = require("path");

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
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
    /* ignore read errors */
  }
}

// Auto-load root .env and local .env
loadEnvFile(path.join(process.cwd(), ".env"));
loadEnvFile(path.join(__dirname, "..", "..", ".env"));

module.exports = {
  loadEnvFile,
};
