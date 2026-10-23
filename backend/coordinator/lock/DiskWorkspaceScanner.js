const fs = require("fs");
const path = require("path");
const { locksDirFor } = require("../../lib/paths");
const { canonicalWorkspaceFile } = require("../../lib/paths");
const { workspaceRoot, normWorkspace, lockKey, alive } = require("./LockUtils");
const { LockEntry } = require("../LockEntry");

class DiskWorkspaceScanner {
  constructor(lockTable) {
    this.table = lockTable;
    this.loaded = new Map();
  }

  dirFor(workspaceId) {
    try {
      const root = workspaceRoot(workspaceId) || this.table.defaultWorkspace;
      return root ? locksDirFor(root) : this.table.locksDir;
    } catch {
      return this.table.locksDir;
    }
  }

  ingestEntry(entry, fallbackWorkspace) {
    if (!entry?.filePath || !alive(entry)) return;
    const workspaceId =
      workspaceRoot(entry.workspaceId) ||
      entry.workspaceId ||
      fallbackWorkspace ||
      this.table.defaultWorkspace;
    if (!workspaceId) return;

    const filePath = canonicalWorkspaceFile(workspaceId, entry.filePath);
    if (!filePath) return;

    const lockObj = entry instanceof LockEntry ? entry : new LockEntry({
      ...entry,
      workspaceId,
      filePath,
    });
    const key = lockKey(workspaceId, filePath);
    if (Number.isSafeInteger(lockObj.fencingToken)) {
      this.table.fencingManager.set(workspaceId, filePath, lockObj.fencingToken);
    }
    this.table.locks.set(key, lockObj);
  }

  loadWorkspace(workspacePath) {
    const root = workspaceRoot(workspacePath) || workspacePath;
    if (!root) return;
    const mark = normWorkspace(root);
    let dir;
    try {
      dir = locksDirFor(root);
    } catch {
      return;
    }
    if (!dir || !fs.existsSync(dir)) return;

    let stamp = 0;
    try {
      stamp = fs.statSync(dir).mtimeMs;
    } catch {
      return;
    }

    const seen = this.loaded.get(mark);
    if (seen && seen.stamp === stamp && Date.now() - seen.at < 1000) return;
    this.loaded.set(mark, { stamp, at: Date.now() });

    let names = [];
    try {
      names = fs.readdirSync(dir);
    } catch {
      return;
    }

    let added = false;
    for (const name of names) {
      if (!name.endsWith(".lock")) continue;
      try {
        const entry = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
        const key = lockKey(workspaceRoot(entry.workspaceId) || entry.workspaceId || root, entry.filePath);
        if (this.table.locks.has(key)) continue;
        const before = this.table.locks.size;
        this.ingestEntry(entry, root);
        if (this.table.locks.size !== before) added = true;
      } catch {
        /* partially written lock file retried on next scan */
      }
    }

    if (added) {
      setImmediate(() => this.table.emit("change", { type: "adopted", workspaceId: root }));
    }
  }

  loadFromDisk() {
    if (this.table.defaultWorkspace) {
      this.loadWorkspace(this.table.defaultWorkspace);
    } else if (this.table.locksDir && fs.existsSync(this.table.locksDir)) {
      const root = path.resolve(this.table.locksDir, "..", "..");
      this.loadWorkspace(root);
    }
  }
}

module.exports = { DiskWorkspaceScanner };
