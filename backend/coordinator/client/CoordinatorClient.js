const { canonicalWorkspaceFile } = require("../../lib/paths");
const { loadRoom } = require("../../lib/room");
const { CoordinatorStateReader } = require("./CoordinatorStateReader");
const { LeaseCredentialStore } = require("./LeaseCredentialStore");
const { HttpRpcClient } = require("./HttpRpcClient");
const { RoomRoutingStrategy } = require("./RoomRoutingStrategy");

const HTTP_TIMEOUT_MS = 2000;

class CoordinatorClient {
  static async claimFile(workspacePath, agentId, file, ttlMs = 15000, opts = {}) {
    const started = Date.now();
    const room = loadRoom(workspacePath);
    const files = Array.isArray(opts.files) && opts.files.length ? opts.files : [file];
    const payload = {
      agentId,
      file,
      ttl: ttlMs,
      workspaceId: workspacePath,
      dependsOn: opts.dependsOn,
      files: opts.files,
      mode: opts.mode,
      keepAlive: opts.keepAlive === true,
      holder: opts.holder || null,
      annotation: typeof opts.annotation === "string" ? opts.annotation.slice(0, 140) : undefined,
      leases: files.map((item) => {
        const lease = LeaseCredentialStore.readLease(workspacePath, agentId, item);
        return lease ? { ...lease, file: lease.filePath } : null;
      }).filter(Boolean),
    };

    let degraded = null;
    try {
      const remaining = Math.max(80, 800 - (Date.now() - started));
      const { body } = await HttpRpcClient.postJson(
        CoordinatorStateReader.apiPort(workspacePath),
        "/api/coord/claim",
        RoomRoutingStrategy.roomPayload(room, workspacePath, payload),
        remaining
      );
      if (body?.degraded) {
        degraded = { ...body, source: body.source || "local_fallback" };
      } else if (body && typeof body.allowed === "boolean") {
        if (body.allowed) LeaseCredentialStore.persistClaimLeases(workspacePath, agentId, body);
        return { ...body, source: body.source || "control" };
      }
    } catch {
      /* coordinator / remote fallback */
    }

    if (RoomRoutingStrategy.roomUsable(room)) {
      try {
        const { body } = await HttpRpcClient.postRemote(
          room.url,
          "/api/coord/claim",
          RoomRoutingStrategy.roomPayload(room, workspacePath, payload),
          HTTP_TIMEOUT_MS,
          room.memberToken
        );
        if (typeof body.allowed === "boolean") {
          if (body.allowed) LeaseCredentialStore.persistClaimLeases(workspacePath, agentId, body);
          return { ...body, source: body.source || "room" };
        }
        throw new Error("The room returned an invalid lock response.");
      } catch {
        RoomRoutingStrategy.markRoomDown(room);
      }
    }

    if (degraded) {
      console.warn("[latch] HOST_UNREACHABLE — claim refused rather than granted locally");
      return degraded;
    }

    const port = CoordinatorStateReader.readPort(workspacePath);
    if (port) {
      try {
        const remaining = Math.max(50, HTTP_TIMEOUT_MS - (Date.now() - started));
        const { body } = await HttpRpcClient.postJson(port, "/claim", payload, remaining);
        if (typeof body.allowed === "boolean") {
          if (body.allowed) LeaseCredentialStore.persistClaimLeases(workspacePath, agentId, body);
          return { ...body, source: body.source || "coordinator" };
        }
        throw new Error("The coordinator returned an invalid lock response.");
      } catch {
        /* fall through */
      }
    }

    // Direct Supabase fallback when coordinator daemon is offline
    try {
      const { isSupabaseConfigured } = require("../../supabase/client");
      if (isSupabaseConfigured()) {
        const { SupabaseLockAdapter } = require("../../supabase/SupabaseLockAdapter");
        const adapter = new SupabaseLockAdapter();
        if (adapter.enabled) {
          const canonical = canonicalWorkspaceFile(workspacePath, file) || file;
          const savedLease = LeaseCredentialStore.readLease(workspacePath, agentId, canonical);
          const res = await adapter.claim({
            workspaceId: workspacePath,
            file: canonical,
            agentId,
            sessionId: opts.sessionId || (savedLease?.sessionId || ""),
            ownershipToken: savedLease?.ownershipToken,
            fencingToken: savedLease?.fencingToken,
            mode: opts.mode || "write",
            ttl: ttlMs,
            holder: opts.holder || {},
          });
          if (res && typeof res.allowed === "boolean") {
            if (res.allowed) LeaseCredentialStore.persistClaimLeases(workspacePath, agentId, res);
            return { ...res, source: "supabase" };
          }
        }
      }
    } catch {
      /* fallback */
    }

    console.warn("[latch] COORDINATOR_UNAVAILABLE — write claim refused");
    return {
      allowed: false,
      degraded: true,
      source: "unavailable",
      code: "COORDINATOR_UNAVAILABLE",
      reason: "The shared coordinator could not verify this file lease.",
    };
  }

  static async releaseFile(workspacePath, agentId, file) {
    const room = loadRoom(workspacePath);
    const lease = LeaseCredentialStore.readLease(workspacePath, agentId, file);
    const payload = {
      agentId,
      file,
      workspaceId: workspacePath,
      ownershipToken: lease?.ownershipToken,
      fencingToken: lease?.fencingToken,
    };
    try {
      const { body } = await HttpRpcClient.postJson(
        CoordinatorStateReader.apiPort(workspacePath),
        "/api/coord/release",
        RoomRoutingStrategy.roomPayload(room, workspacePath, payload),
        600
      );
      if (body && !body.degraded) {
        if (body.released || body.released === false) {
          LeaseCredentialStore.removeLease(workspacePath, agentId, file);
        }
        return body;
      }
    } catch {
      /* remote / coordinator fallback */
    }

    if (RoomRoutingStrategy.roomUsable(room)) {
      try {
        const { body } = await HttpRpcClient.postRemote(
          room.url,
          "/api/coord/release",
          RoomRoutingStrategy.roomPayload(room, workspacePath, payload),
          HTTP_TIMEOUT_MS,
          room.memberToken
        );
        if (body && typeof body.released === "boolean") {
          LeaseCredentialStore.removeLease(workspacePath, agentId, file);
          return body;
        }
      } catch {
        RoomRoutingStrategy.markRoomDown(room);
      }
    }

    const port = CoordinatorStateReader.readPort(workspacePath);
    if (port) {
      try {
        const { body } = await HttpRpcClient.postJson(port, "/release", payload, HTTP_TIMEOUT_MS);
        if (body?.released) LeaseCredentialStore.removeLease(workspacePath, agentId, file);
        return body;
      } catch {
        /* fall through */
      }
    }

    try {
      const { isSupabaseConfigured } = require("../../supabase/client");
      if (isSupabaseConfigured()) {
        const { SupabaseLockAdapter } = require("../../supabase/SupabaseLockAdapter");
        const adapter = new SupabaseLockAdapter();
        if (adapter.enabled) {
          const canonical = canonicalWorkspaceFile(workspacePath, file) || file;
          const res = await adapter.release({
            workspaceId: workspacePath,
            file: canonical,
            agentId,
            ownershipToken: lease?.ownershipToken,
            fencingToken: lease?.fencingToken,
          });
          if (res?.released) LeaseCredentialStore.removeLease(workspacePath, agentId, canonical);
          return res;
        }
      }
    } catch {
      /* ignored */
    }

    return { ok: true, released: false, degraded: true };
  }

  static async heartbeat(workspacePath, agentId, file, ttlMs) {
    const room = loadRoom(workspacePath);
    const lease = file ? LeaseCredentialStore.readLease(workspacePath, agentId, file) : null;
    const leases = LeaseCredentialStore.readLeases(workspacePath, agentId);
    const payload = {
      agentId,
      file,
      ttl: ttlMs,
      workspaceId: workspacePath,
      ownershipToken: lease?.ownershipToken,
      fencingToken: lease?.fencingToken,
      leases: leases.map((item) => ({ ...item, file: item.filePath })),
    };

    try {
      const { body } = await HttpRpcClient.postJson(
        CoordinatorStateReader.apiPort(workspacePath),
        "/api/coord/heartbeat",
        RoomRoutingStrategy.roomPayload(room, workspacePath, payload),
        600
      );
      if (body && !body.degraded) return body;
    } catch {
      /* fall through */
    }

    if (RoomRoutingStrategy.roomUsable(room)) {
      try {
        const { body } = await HttpRpcClient.postRemote(
          room.url,
          "/api/coord/heartbeat",
          RoomRoutingStrategy.roomPayload(room, workspacePath, payload),
          HTTP_TIMEOUT_MS,
          room.memberToken
        );
        if (body && typeof body.ok === "boolean") return body;
      } catch {
        RoomRoutingStrategy.markRoomDown(room);
      }
    }

    const port = CoordinatorStateReader.readPort(workspacePath);
    if (!port) return { ok: false, reason: "no_coordinator" };
    try {
      const { body } = await HttpRpcClient.postJson(port, "/heartbeat", payload, HTTP_TIMEOUT_MS);
      return body;
    } catch {
      return { ok: false, reason: "coordinator_unreachable" };
    }
  }

  static async getStatus(workspacePath) {
    const port = CoordinatorStateReader.readPort(workspacePath);
    if (!port) return null;
    try {
      return await HttpRpcClient.getJson(port, "/status", HTTP_TIMEOUT_MS);
    } catch {
      return null;
    }
  }

  static async notifyPatch(workspacePath, patch) {
    const port = CoordinatorStateReader.readPort(workspacePath);
    if (!port) return false;
    try {
      await HttpRpcClient.postJson(port, "/patch", patch, HTTP_TIMEOUT_MS);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = {
  CoordinatorClient,
  claimFile: CoordinatorClient.claimFile,
  releaseFile: CoordinatorClient.releaseFile,
  heartbeat: CoordinatorClient.heartbeat,
  getStatus: CoordinatorClient.getStatus,
  notifyPatch: CoordinatorClient.notifyPatch,
  readPort: CoordinatorStateReader.readPort,
  apiPort: CoordinatorStateReader.apiPort,
  readState: CoordinatorStateReader.readState,
  readLease: LeaseCredentialStore.readLease,
  readLeases: LeaseCredentialStore.readLeases,
  saveLease: LeaseCredentialStore.saveLease,
  removeLease: LeaseCredentialStore.removeLease,
  persistClaimLeases: LeaseCredentialStore.persistClaimLeases,
};
