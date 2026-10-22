const { canonicalWorkspaceFile } = require("../../lib/paths");

class SupabaseClaimStrategy {
  constructor({ supabaseLockAdapter, lockTable, recordClaimDenied }) {
    this.adapter = supabaseLockAdapter;
    this.lockTable = lockTable;
    this.recordClaimDenied = recordClaimDenied;
  }

  async executeClaim(scoped, ensureWorkspaceFn) {
    const rawFiles = Array.isArray(scoped.files) && scoped.files.length ? scoped.files : [scoped.file];
    const files = [...new Set(rawFiles.map((file) => canonicalWorkspaceFile(scoped.workspaceId, file)))].sort();
    if (files.some((file) => !file)) {
      return { allowed: false, code: "INVALID_PATH", reason: "file path is outside the workspace" };
    }

    const acquired = [];
    const rollback = async () => {
      for (const item of acquired.reverse()) {
        if (!item.dbResult.renewed) {
          await this.adapter.release({
            workspaceId: scoped.workspaceId,
            file: item.file,
            agentId: scoped.agentId,
            sessionId: scoped.sessionId,
            ownershipToken: item.dbResult.ownershipToken,
            fencingToken: Number(item.dbResult.fencingToken),
          });
        }
        if (!item.localResult.renewed) {
          this.lockTable.release({
            agentId: scoped.agentId,
            file: item.file,
            workspaceId: scoped.workspaceId,
            ownershipToken: item.dbResult.ownershipToken,
            fencingToken: Number(item.dbResult.fencingToken),
          });
        }
      }
    };

    for (const file of files) {
      const savedLease = scoped.leases.find((lease) => canonicalWorkspaceFile(scoped.workspaceId, lease.file) === file);
      const dbResult = await this.adapter.claim({
        workspaceId: scoped.workspaceId,
        file,
        agentId: scoped.agentId,
        sessionId: scoped.sessionId,
        ownershipToken: savedLease?.ownershipToken || scoped.ownershipToken,
        fencingToken: savedLease?.fencingToken ?? scoped.fencingToken,
        mode: scoped.mode,
        keepAlive: scoped.keepAlive,
        ttl: scoped.ttl,
        holder: scoped.holder,
        annotation: scoped.annotation,
      });

      if (!dbResult) {
        await rollback();
        return {
          allowed: false,
          degraded: true,
          code: "COORDINATOR_UNAVAILABLE",
          reason: "The shared lock service could not verify this lease.",
        };
      }

      if (!dbResult.allowed) {
        await rollback();
        this.recordClaimDenied({ ...scoped, file }, dbResult, ensureWorkspaceFn);
        return dbResult;
      }

      if (!dbResult.ownershipToken || !Number.isSafeInteger(Number(dbResult.fencingToken))) {
        await rollback();
        return {
          allowed: false,
          degraded: true,
          code: "LEASE_CREDENTIALS_MISSING",
          reason: "The shared lock service granted a lease without usable credentials.",
        };
      }

      const localResult = this.lockTable.claim({
        ...scoped,
        file,
        files: undefined,
        leases: [],
        authoritativeLease: {
          ownershipToken: dbResult.ownershipToken,
          fencingToken: Number(dbResult.fencingToken),
        },
      });

      if (!localResult.allowed) {
        if (!dbResult.renewed) {
          await this.adapter.release({
            workspaceId: scoped.workspaceId,
            file,
            agentId: scoped.agentId,
            sessionId: scoped.sessionId,
            ownershipToken: dbResult.ownershipToken,
            fencingToken: Number(dbResult.fencingToken),
          });
        }
        await rollback();
        this.recordClaimDenied({ ...scoped, file }, localResult, ensureWorkspaceFn);
        return localResult;
      }

      acquired.push({ file, dbResult, localResult });
    }

    if (files.length > 1) {
      return {
        allowed: true,
        batch: files,
        locks: acquired.map((item) => item.localResult.lock || item.localResult),
      };
    }
    return acquired[0].localResult;
  }
}

module.exports = { SupabaseClaimStrategy };
