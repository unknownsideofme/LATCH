"use strict";

const { EventEmitter } = require("events");
const { getSupabaseClient } = require("./client");

class SupabaseLockAdapter extends EventEmitter {
  constructor() {
    super();
    this.client = getSupabaseClient();
    this.subscription = null;
    this.activeWorkspaceId = null;
  }

  get enabled() {
    return Boolean(this.client);
  }

  async claim({ workspaceId, file, agentId, mode = "write", ttl = 15000, holder = {} }) {
    if (!this.client) return null;
    const ttlMs = Math.max(5000, Math.min(300000, Number(ttl) || 15000));
    try {
      const params = {
        p_workspace_id: workspaceId,
        p_file_path: file,
        p_agent_id: agentId,
        p_mode: mode,
        p_ttl_ms: ttlMs,
        p_holder: holder || {},
      };
      let res = await this.client.rpc("latch_claim_lock", params);
      if (res.error && res.error.message?.includes("not find the function")) {
        res = await this.client.rpc("relay_claim_lock", params);
      }

      if (res.error) {
        console.warn(`[latch-supabase] claim RPC error: ${res.error.message}`);
        return null;
      }

      return res.data;
    } catch (err) {
      console.warn(`[latch-supabase] claim exception: ${err.message || err}`);
      return null;
    }
  }

  async release({ workspaceId, file, agentId }) {
    if (!this.client) return null;
    try {
      const params = {
        p_workspace_id: workspaceId,
        p_file_path: file,
        p_agent_id: agentId,
      };
      let res = await this.client.rpc("latch_release_lock", params);
      if (res.error && res.error.message?.includes("not find the function")) {
        res = await this.client.rpc("relay_release_lock", params);
      }

      if (res.error) {
        console.warn(`[latch-supabase] release RPC error: ${res.error.message}`);
        return null;
      }

      return res.data;
    } catch (err) {
      console.warn(`[latch-supabase] release exception: ${err.message || err}`);
      return null;
    }
  }

  async heartbeat({ workspaceId, file, agentId, ttl = 15000 }) {
    return this.claim({ workspaceId, file, agentId, ttl });
  }

  async releaseAll(agentId, workspaceId) {
    if (!this.client) return null;
    try {
      let query = this.client.from("relay_locks").delete().eq("agent_id", agentId);
      if (workspaceId) query = query.eq("workspace_id", workspaceId);
      const { error } = await query;
      return { ok: !error };
    } catch {
      return { ok: false };
    }
  }

  async list(workspaceId) {
    if (!this.client) return [];
    try {
      const now = new Date().toISOString();
      let query = this.client
        .from("relay_locks")
        .select("*")
        .gt("expires_at", now);

      if (workspaceId) query = query.eq("workspace_id", workspaceId);

      const { data, error } = await query;
      if (error || !Array.isArray(data)) return [];

      return data.map((row) => ({
        filePath: row.file_path,
        agentId: row.agent_id,
        mode: row.mode,
        claimedAt: new Date(row.claimed_at).getTime(),
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
    if (this.subscription) {
      this.client.removeChannel(this.subscription);
      this.subscription = null;
    }

    this.activeWorkspaceId = workspaceId;
    const channelName = `latch-locks-${workspaceId ? workspaceId.replace(/[^a-zA-Z0-9]/g, "-") : "all"}`;

    this.subscription = this.client
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "relay_locks",
          ...(workspaceId ? { filter: `workspace_id=eq.${workspaceId}` } : {}),
        },
        async (payload) => {
          this.emit("change", payload);
          if (typeof onLockChange === "function") {
            const currentLocks = await this.list(workspaceId);
            onLockChange(currentLocks, payload);
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log(`[latch-supabase] Subscribed to realtime lock changes (${channelName})`);
        }
      });
  }

  close() {
    if (this.subscription && this.client) {
      this.client.removeChannel(this.subscription);
      this.subscription = null;
    }
  }
}

module.exports = {
  SupabaseLockAdapter,
};
