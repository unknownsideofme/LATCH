const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
  homeLatchDir,
  canonicalWorkspaceFile,
  canonicalWorkspaceRoot,
} = require("../../lib/paths");

class LeaseCredentialStore {
  static leaseDirectory(workspacePath, agentId) {
    const root = canonicalWorkspaceRoot(workspacePath) || path.resolve(workspacePath);
    const workspaceKey = process.platform === "win32" ? root.toLowerCase() : root;
    const ownerKey = `${workspaceKey}::${agentId}`;
    const ownerHash = crypto.createHash("sha256").update(ownerKey).digest("hex");
    const dir = path.join(homeLatchDir(), "leases", ownerHash);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    return dir;
  }

  static leasePath(workspacePath, agentId, file) {
    const canonicalFile = canonicalWorkspaceFile(workspacePath, file);
    if (!canonicalFile) return null;
    const hash = crypto.createHash("sha256").update(canonicalFile).digest("hex");
    return path.join(LeaseCredentialStore.leaseDirectory(workspacePath, agentId), `${hash}.json`);
  }

  static readLease(workspacePath, agentId, file) {
    const target = LeaseCredentialStore.leasePath(workspacePath, agentId, file);
    if (!target) return null;
    try {
      const lease = JSON.parse(fs.readFileSync(target, "utf8"));
      const root = canonicalWorkspaceRoot(workspacePath) || path.resolve(workspacePath);
      const workspaceKey = process.platform === "win32" ? root.toLowerCase() : root;
      return lease.workspaceKey === workspaceKey &&
        lease.agentId === agentId &&
        lease.filePath === canonicalWorkspaceFile(workspacePath, file)
        ? lease
        : null;
    } catch {
      return null;
    }
  }

  static saveLease(workspacePath, agentId, file, lease) {
    if (!lease?.ownershipToken || !Number.isSafeInteger(Number(lease.fencingToken))) return;
    const target = LeaseCredentialStore.leasePath(workspacePath, agentId, file);
    if (!target) return;
    const temp = `${target}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
    const root = canonicalWorkspaceRoot(workspacePath) || path.resolve(workspacePath);
    const workspaceKey = process.platform === "win32" ? root.toLowerCase() : root;
    fs.writeFileSync(
      temp,
      JSON.stringify({
        workspaceKey,
        agentId,
        filePath: canonicalWorkspaceFile(workspacePath, file),
        sessionId: lease.sessionId || "",
        ownershipToken: lease.ownershipToken,
        fencingToken: Number(lease.fencingToken),
      }),
      { mode: 0o600 }
    );
    fs.renameSync(temp, target);
  }

  static removeLease(workspacePath, agentId, file) {
    const target = LeaseCredentialStore.leasePath(workspacePath, agentId, file);
    if (!target) return;
    try {
      fs.unlinkSync(target);
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
  }

  static readLeases(workspacePath, agentId) {
    const dir = LeaseCredentialStore.leaseDirectory(workspacePath, agentId);
    const leases = [];
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".json")) continue;
      try {
        const lease = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
        const root = canonicalWorkspaceRoot(workspacePath) || path.resolve(workspacePath);
        const workspaceKey = process.platform === "win32" ? root.toLowerCase() : root;
        if (lease.workspaceKey === workspaceKey && lease.agentId === agentId) {
          leases.push(lease);
        }
      } catch {
        /* invalid local credential ignored */
      }
    }
    return leases;
  }

  static persistClaimLeases(workspacePath, agentId, result) {
    const locks = Array.isArray(result.locks) ? result.locks : result.lock ? [result.lock] : [result];
    for (const lock of locks) {
      const file = lock.filePath || lock.file || result.filePath || result.file;
      if (!file) continue;
      LeaseCredentialStore.saveLease(workspacePath, agentId, file, lock);
    }
  }
}

module.exports = { LeaseCredentialStore };
