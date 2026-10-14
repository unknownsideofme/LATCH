"use strict";

const VERSION = "0.1.0";
const UI_ORIGIN = process.env.LATCH_UI_ORIGIN || process.env.RELAY_UI_ORIGIN || "http://localhost:3002";

const HOOK_ROUTES = new Set([
  "/api/ensure-workspace",
  "/api/ingest-stop",
  "/api/flush-file",
  "/api/flush-owned",
  "/api/coord/claim",
  "/api/coord/release",
  "/api/coord/release-all",
  "/api/coord/heartbeat",
]);

const LOCK_OPS = new Set(["claim", "release", "heartbeat", "release-all", "read"]);

const DEFAULT_PORT = 3001;
const HOST_TIMEOUT_MS = 2500;
const SEED_TIMEOUT_MS = 120_000;
const HOST_BACKOFF_MAX_MS = 8_000;
const MAX_DIFF_BYTES = 8000;
const PATCH_ROWS = 100;
const MAX_FRAME_BYTES = 64 * 1024;
const RPC_BURST = 60;
const MAX_FILES_PER_CLAIM = 64;
const INGEST_COOLDOWN_MS = 2500;
const DEFERRED_MAX_MS = 5 * 60 * 1000;
const WATCH_SETTLE_MS = 60;
const OWNERSHIP_TTL_MS = 10000;

function parsePort(argv = process.argv) {
  const idx = argv.indexOf("--port");
  if (idx >= 0 && argv[idx + 1]) return Number(argv[idx + 1]);
  return Number(process.env.LATCH_PORT || process.env.RELAY_PORT || DEFAULT_PORT);
}

module.exports = {
  VERSION,
  UI_ORIGIN,
  HOOK_ROUTES,
  LOCK_OPS,
  DEFAULT_PORT,
  HOST_TIMEOUT_MS,
  SEED_TIMEOUT_MS,
  HOST_BACKOFF_MAX_MS,
  MAX_DIFF_BYTES,
  PATCH_ROWS,
  MAX_FRAME_BYTES,
  RPC_BURST,
  MAX_FILES_PER_CLAIM,
  INGEST_COOLDOWN_MS,
  DEFERRED_MAX_MS,
  WATCH_SETTLE_MS,
  OWNERSHIP_TTL_MS,
  parsePort,
};
