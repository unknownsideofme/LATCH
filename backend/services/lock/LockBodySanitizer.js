const { MAX_FILES_PER_CLAIM } = require("../../config/constants");
const { LockEntry } = require("../../coordinator/LockEntry");

class LockBodySanitizer {
  static sanitize(body, session) {
    const clean = {
      agentId: String(body?.agentId || "").slice(0, 200),
      file: typeof body?.file === "string" ? body.file.slice(0, 1024) : undefined,
      workspaceId: typeof body?.workspaceId === "string" ? body.workspaceId : undefined,
      ttl: Number(body?.ttl) || undefined,
      mode: body?.mode === "read" ? "read" : "write",
      keepAlive: body?.keepAlive === true,
      files: Array.isArray(body?.files)
        ? body.files.filter((f) => typeof f === "string").slice(0, MAX_FILES_PER_CLAIM)
        : undefined,
      dependsOn: Array.isArray(body?.dependsOn)
        ? body.dependsOn.filter((f) => typeof f === "string").slice(0, MAX_FILES_PER_CLAIM)
        : undefined,
      holder: body?.holder && typeof body.holder === "object" ? body.holder : null,
      annotation: typeof body?.annotation === "string" ? LockEntry.sanitizeAnnotation(body.annotation) : undefined,
      sessionId: typeof body?.sessionId === "string" ? body.sessionId.slice(0, 200) : undefined,
      ownershipToken: typeof body?.ownershipToken === "string" ? body.ownershipToken : undefined,
      fencingToken: Number.isInteger(body?.fencingToken) ? body.fencingToken : undefined,
      leases: Array.isArray(body?.leases)
        ? body.leases.filter((lease) => lease && typeof lease.file === "string").slice(0, MAX_FILES_PER_CLAIM).map((lease) => ({
            file: lease.file.slice(0, 1024),
            ownershipToken: typeof lease.ownershipToken === "string" ? lease.ownershipToken : undefined,
            fencingToken: Number.isSafeInteger(lease.fencingToken) ? lease.fencingToken : undefined,
          }))
        : [],
    };
    if (!clean.agentId) return null;
    if (!clean.sessionId) {
      const parts = clean.agentId.split(":");
      clean.sessionId = parts.length > 2 ? parts.slice(2).join(":") : "";
    }
    if (session?.remote) {
      const login = session.login || "guest";
      clean.agentId = `${clean.agentId}@${login}`;
      clean.holder = { ...(clean.holder || {}), login };
    }
    return clean;
  }
}

module.exports = { LockBodySanitizer };
