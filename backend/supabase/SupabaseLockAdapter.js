"use strict";

const { EventEmitter } = require("events");
const { getSupabaseClient } = require("./client");

const MAX_HOOK_KEEP_ALIVE_MS = 5 * 60_000;

function leaseKey(workspaceId, file, agentId) {
  return `${workspaceId}::${file}::${agentId}`;
}

class SupabaseLockAdapter extends EventEmitter {
  constructor() {
    super();
    this.client = getSupabaseClient();
    this.subscription = null;
    this.activeWorkspaceId = null;
    this.leases = new Map();
    this.keepAliveTimers = new Map();
  }

  get enabled() {
    return Boolean(this.client);
  }

  async claim({ workspaceId, file, agentId, sessionId = "", mode = "write", ttl = 15000, holder = {}, ownershipToken, fencingToken, keepAlive = false }) {
    if (!this.client) return null;
    const ttlMs = Math.max(5000, Math.min(300000, Number(ttl) || 15000));
    const params = {
      p_workspace_id: workspaceId,
      p_file_path: file,
      p_agent_id: agentId,
      p_session_id: sessionId,
      p_ownership_token: ownershipToken || null,
      p_fencing_token: fencingToken || null,
      p_mode: mode,
      p_ttl_ms: ttlMs,
      p_holder: holder || {},
    };
    try {
      let res = await this.client.rpc("latch_claim_lock", params);
      if (res.error && res.error.message?.includes("not find the function")) {
        res = await this.client.rpc("relay_claim_lock", params);
      }
      if (res.error) {
        console.warn(`[latch-supabase] claim RPC error: ${res.error.message}`);
        return null;
      }
      if (res.data?.allowed && res.data.ownershipToken && res.data.fencingToken != null) {
        const key = leaseKey(workspaceId, file, agentId);
        const lease = {
          sessionId,
          ownershipToken: res.data.ownershipToken,
          fencingToken: Number(res.data.fencingToken),
        };
        this.leases.set(key, lease);
        if (keepAlive && mode !== "read") this.startKeepAlive(key, { workspaceId, file, agentId, ...lease }, ttlMs);
      }
      return res.data;
    } catch (err) {
      console.warn(`[latch-supabase] claim exception: ${err.message || err}`);
      return null;
    }
  }

  startKeepAlive(key, lease, ttl) {
    this.stopKeepAlive(key);
    const stopAt = Date.now() + MAX_HOOK_KEEP_ALIVE_MS;
    const intervalMs = Math.max(1000, Math.floor(ttl / 3));
    const active = { stopAt, timer: null, running: false, ownershipToken: lease.ownershipToken, fencingToken: lease.fencingToken };
    active.timer = setInterval(async () => {
      if (Date.now() >= active.stopAt) {
        this.stopKeepAlive(key, lease);
        return;
      }
      if (active.running) return;
      active.running = true;
      try {
        const result = await this.heartbeat({ ...lease, ttl });
        if (result?.ok === false) this.stopKeepAlive(key, lease);
      } finally {
        active.running = false;
      }
    }, intervalMs);
    if (active.timer.unref) active.timer.unref();
    this.keepAliveTimers.set(key, active);
  }

  stopKeepAlive(key, lease) {
    const active = this.keepAliveTimers.get(key);
    if (!active) return;
    if (lease && (active.ownershipToken !== lease.ownershipToken || active.fencingToken !== lease.fencingToken)) return;
    clearInterval(active.timer);
    this.keepAliveTimers.delete(key);
  }

  leaseFor(workspaceId, file, agentId, sessionId, ownershipToken, fencingToken) {
    const lease = this.leases.get(leaseKey(workspaceId, file, agentId));
    return {
      sessionId: sessionId || lease?.sessionId || "",
      ownershipToken: ownershipToken || lease?.ownershipToken,
      fencingToken: fencingToken ?? lease?.fencingToken,
    };
  }

  async release({ workspaceId, file, agentId, sessionId, ownershipToken, fencingToken }) {
    if (!this.client) return null;
    const lease = this.leaseFor(workspaceId, file, agentId, sessionId, ownershipToken, fencingToken);
    if (!lease.ownershipToken || lease.fencingToken == null) return { ok: false, reason: "lease_required" };
    const params = {
      p_workspace_id: workspaceId,
      p_file_path: file,
      p_agent_id: agentId,
      p_session_id: lease.sessionId,
      p_ownership_token: lease.ownershipToken,
      p_fencing_token: lease.fencingToken,
    };
    try {
      let res = await this.client.rpc("latch_release_lock", params);
      if (res.error && res.error.message?.includes("not find the function")) {
        res = await this.client.rpc("relay_release_lock", params);
      }
      if (res.error) {
        console.warn(`[latch-supabase] release RPC error: ${res.error.message}`);
        return null;
      }
      const key = leaseKey(workspaceId, file, agentId);
      const current = this.leases.get(key);
      if (current?.ownershipToken === lease.ownershipToken && current.fencingToken === lease.fencingToken) {
        this.leases.delete(key);
        this.stopKeepAlive(key, lease);
      }
      return res.data;
    } catch (err) {
      console.warn(`[latch-supabase] release exception: ${err.message || err}`);
      return null;
    }
  }

  async heartbeat({ workspaceId, file, agentId, sessionId, ttl = 15000, ownershipToken, fencingToken }) {
    if (!this.client) return null;
    const lease = this.leaseFor(workspaceId, file, agentId, sessionId, ownershipToken, fencingToken);
    if (!lease.ownershipToken || lease.fencingToken == null) return { ok: false, reason: "lease_required" };
    const params = {
      p_workspace_id: workspaceId,
      p_file_path: file,
      p_agent_id: agentId,
      p_session_id: lease.sessionId,
      p_ownership_token: lease.ownershipToken,
      p_fencing_token: lease.fencingToken,
      p_ttl_ms: Math.max(5000, Math.min(300000, Number(ttl) || 15000)),
    };
    try {
      let res = await this.client.rpc("latch_heartbeat_lock", params);
      if (res.error && res.error.message?.includes("not find the function")) {
        res = await this.client.rpc("relay_heartbeat_lock", params);
      }
      if (res.error) {
        console.warn(`[latch-supabase] heartbeat RPC error: ${res.error.message}`);
        return null;
      }
      return res.data;
    } catch (err) {
      console.warn(`[latch-supabase] heartbeat exception: ${err.message || err}`);
      return null;
    }
  }

  async releaseAll(agentId, workspaceId, sessionId = "") {
    if (!this.client) return null;
    const leases = [...this.leases.entries()].filter(([key, lease]) => {
      const parts = key.split("::");
      return parts[2] === agentId && (!workspaceId || parts[0] === workspaceId) && (!sessionId || lease.sessionId === sessionId);
    });
    const released = [];
    for (const [key, lease] of leases) {
      const [workspace, file] = key.split("::");
      const result = await this.release({ workspaceId: workspace, file, agentId, sessionId, ...lease });
      if (result?.released) released.push(file);
    }
    return { ok: true, released };
  }

  async list(workspaceId) {
    if (!this.client) return [];
    try {
      let query = this.client.from("relay_locks").select("*").gt("expires_at", new Date().toISOString());
      if (workspaceId) query = query.eq("workspace_id", workspaceId);
      const { data, error } = await query;
      if (error || !Array.isArray(data)) return [];
      return data.map((row) => ({
        filePath: row.file_path,
        agentId: row.agent_id,
        sessionId: row.session_id,
        ownershipToken: row.ownership_token,
        fencingToken: row.fencing_token,
        mode: row.mode,
        claimedAt: new Date(row.claimed_at).getTime(),
        lastHeartbeat: new Date(row.last_renewed_at).getTime(),
        expiresAt: new Date(row.expires_at).getTime(),
        ttlMs: row.ttl_ms,
        workspaceId: row.workspace_id,
        holder: row.holder || {},
      }));
    } catch {
      return [];
    }
  }

  subscribe(workspaceId, onLockChange) {
    if (!this.client) return;
    if (this.subscription) this.client.removeChannel(this.subscription);
    this.activeWorkspaceId = workspaceId;
    const channelName = `latch-locks-${workspaceId ? workspaceId.replace(/[^a-zA-Z0-9]/g, "-") : "all"}`;
    this.subscription = this.client.channel(channelName).on(
      "postgres_changes",
      { event: "*", schema: "public", table: "relay_locks", ...(workspaceId ? { filter: `workspace_id=eq.${workspaceId}` } : {}) },
      async (payload) => {
        this.emit("change", payload);
        if (typeof onLockChange === "function") onLockChange(await this.list(workspaceId), payload);
      }
    ).subscribe((status) => {
      if (status === "SUBSCRIBED") console.log(`[latch-supabase] Subscribed to realtime lock changes (${channelName})`);
    });
  }

  close() {
    if (this.subscription && this.client) this.client.removeChannel(this.subscription);
    this.subscription = null;
  }
}

module.exports = { SupabaseLockAdapter };
