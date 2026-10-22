const fs = require("fs");
const path = require("path");
const { lockHash } = require("./LockUtils");

class LockStorageBridge {
  constructor(dirResolver) {
    this.dirResolver = dirResolver;
  }

  persist(entry) {
    try {
      const dir = this.dirResolver(entry.workspaceId);
      if (!dir) return false;
      const serial = typeof entry.toSerializable === "function"
        ? entry.toSerializable()
        : { ...entry, readers: [...(entry.readers || [])] };
      fs.writeFileSync(
        path.join(dir, `${lockHash(entry.filePath, entry.workspaceId)}.lock`),
        JSON.stringify(serial, null, 2),
        { mode: 0o600 }
      );
      return true;
    } catch {
      /* In-memory lock is authoritative; drive error must not drop claim */
      return false;
    }
  }

  unpersist(filePath, workspaceId) {
    const dir = this.dirResolver(workspaceId);
    if (!dir) return;
    for (const name of [lockHash(filePath, workspaceId), lockHash(filePath)]) {
      try {
        fs.unlinkSync(path.join(dir, `${name}.lock`));
      } catch {
        /* ignore missing lock files */
      }
    }
  }
}

module.exports = { LockStorageBridge };
