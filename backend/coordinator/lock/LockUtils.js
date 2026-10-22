const path = require("path");
const crypto = require("crypto");
const { canonicalWorkspaceRoot } = require("../../lib/paths");
const { normalizeWorkspaceRoot } = require("../../lib/transcripts/util");
const { DEFAULT_TTL_MS, MIN_TTL_MS, MAX_TTL_MS } = require("./LockConstants");

function clampTtl(ttlMs) {
  const n = Number(ttlMs);
  if (!Number.isFinite(n)) return DEFAULT_TTL_MS;
  return Math.min(MAX_TTL_MS, Math.max(MIN_TTL_MS, n));
}

function normalizeFile(filePath) {
  const value = String(filePath || "")
    .replace(/\\/g, "/")
    .trim();
  if (!value || value.startsWith("/") || /^[a-zA-Z]:\//.test(value)) return "";
  const normalized = path.posix.normalize(value).replace(/^\.?\//, "");
  return normalized === "." || normalized === ".." || normalized.startsWith("../") ? "" : normalized;
}

function normWorkspace(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/\/+$/, "")
    .toLowerCase();
}

function workspaceRoot(value) {
  if (!value || typeof value !== "string") return null;
  if (!/[\\/]/.test(value)) return null;
  return canonicalWorkspaceRoot(normalizeWorkspaceRoot(value) || path.resolve(value));
}

function lockKey(workspaceId, filePath) {
  return `${normWorkspace(workspaceId)}::${normalizeFile(filePath)}`;
}

function lockHash(filePath, workspaceId) {
  const material = workspaceId ? `${normWorkspace(workspaceId)}::${normalizeFile(filePath)}` : normalizeFile(filePath);
  return crypto.createHash("sha256").update(material).digest("hex").slice(0, 16);
}

function sameWorkspace(a, b) {
  if (!a || !b) return false;
  return normWorkspace(a) === normWorkspace(b);
}

function filterKeys(filter) {
  const keys = new Set();
  const add = (value) => {
    if (!value) return;
    keys.add(String(value));
    keys.add(normWorkspace(value));
    const root = workspaceRoot(value);
    if (root) keys.add(normWorkspace(root));
  };
  if (filter && typeof filter === "object") {
    add(filter.id);
    add(filter.path);
    add(filter.workspaceId);
    for (const extra of filter.aliases || []) add(extra);
  } else {
    add(filter);
  }
  return keys;
}

function belongsTo(entry, keys) {
  if (!keys || !keys.size) return false;
  const wid = entry.workspaceId;
  if (!wid) return false;
  return keys.has(String(wid)) || keys.has(normWorkspace(wid));
}

function alive(entry, now = Date.now()) {
  if (entry && typeof entry.isAlive === "function") return entry.isAlive(now);
  const beat = entry.lastHeartbeat || entry.claimedAt;
  return now < beat + entry.ttlMs;
}

module.exports = {
  clampTtl,
  normalizeFile,
  normWorkspace,
  workspaceRoot,
  lockKey,
  lockHash,
  sameWorkspace,
  filterKeys,
  belongsTo,
  alive,
};
