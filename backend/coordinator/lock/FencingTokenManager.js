const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { lockKey, lockHash } = require("./LockUtils");

class FencingTokenManager {
  constructor(dirResolver) {
    this.dirResolver = dirResolver;
    this.tokens = new Map();
  }

  get(workspaceId, filePath) {
    return this.tokens.get(lockKey(workspaceId, filePath)) || 0;
  }

  set(workspaceId, filePath, token) {
    if (Number.isSafeInteger(token)) {
      const key = lockKey(workspaceId, filePath);
      this.tokens.set(key, Math.max(this.tokens.get(key) || 0, token));
    }
  }

  next(workspaceId, filePath, requested) {
    const key = lockKey(workspaceId, filePath);
    let previous = this.tokens.get(key) || 0;
    let dir;
    try {
      dir = this.dirResolver(workspaceId);
      if (!dir) return null;
      const raw = fs.readFileSync(path.join(dir, `${lockHash(filePath, workspaceId)}.fence`), "utf8").trim();
      if (!/^\d+$/.test(raw)) return null;
      const diskValue = Number(raw);
      if (!Number.isSafeInteger(diskValue)) return null;
      previous = Math.max(previous, diskValue);
    } catch (err) {
      if (err.code !== "ENOENT") return null;
    }

    if (requested !== undefined && requested !== null) {
      if (!Number.isSafeInteger(requested) || requested < 1 || requested < previous) return null;
      previous = requested - 1;
    }

    const nextToken = previous + 1;
    const fencePath = path.join(dir, `${lockHash(filePath, workspaceId)}.fence`);
    const tempPath = `${fencePath}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
    try {
      fs.writeFileSync(tempPath, String(nextToken), { mode: 0o600 });
      fs.renameSync(tempPath, fencePath);
    } catch {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        /* temp file cleanup */
      }
      return null;
    }

    this.tokens.set(key, nextToken);
    return nextToken;
  }
}

module.exports = { FencingTokenManager };
