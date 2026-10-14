"use strict";

const { EventEmitter } = require("events");
const { getSupabaseClient } = require("./client");

class SupabaseSyncAdapter extends EventEmitter {
  constructor() {
    super();
    this.client = getSupabaseClient();
    this.channel = null;
    this.workspaceId = null;
  }

  get enabled() {
    return Boolean(this.client);
  }

  async publishPatch(workspaceId, patch) {
    if (!this.client || !patch) return false;
    try {
      const record = {
        id: patch.id,
        workspace_id: workspaceId,
        file_path: patch.file,
        agent: patch.agent || "Agent",
        owner_login: patch.ownerLogin || "local",
        diff: typeof patch.diff === "string" ? patch.diff : null,
        sha256: patch.sha256 || null,
        lamport: Number(patch.lamport) || 0,
        is_binary: Boolean(patch.binary),
        origin_id: patch.originId || null,
        created_at: new Date(patch.ts || Date.now()).toISOString(),
      };

      // 1. Insert into persistent table
      let insertRes = await this.client.from("latch_patches").insert(record);
      if (insertRes.error && insertRes.error.message?.includes("relation") && insertRes.error.message?.includes("does not exist")) {
        insertRes = await this.client.from("relay_patches").insert(record);
      }

      // 2. Broadcast immediately over realtime channel for ultra-low latency
      if (this.channel) {
        await this.channel.send({
          type: "broadcast",
          event: "patch",
          payload: { workspaceId, patch },
        });
      }

      return true;
    } catch (err) {
      console.warn(`[latch-supabase] publishPatch error: ${err.message || err}`);
      return false;
    }
  }

  joinWorkspace(workspaceId, { onPatch, onPresenceChange, userState } = {}) {
    if (!this.client) return;
    if (this.channel) {
      this.client.removeChannel(this.channel);
      this.channel = null;
    }

    this.workspaceId = workspaceId;
    const channelName = `latch-sync-${workspaceId ? workspaceId.replace(/[^a-zA-Z0-9]/g, "-") : "global"}`;

    this.channel = this.client.channel(channelName, {
      config: {
        broadcast: { ack: true },
        presence: { key: userState?.login || "user" },
      },
    });

    // Handle broadcasted patches
    this.channel.on("broadcast", { event: "patch" }, (envelope) => {
      if (envelope?.payload?.patch) {
        this.emit("patch", envelope.payload);
        if (typeof onPatch === "function") onPatch(envelope.payload);
      }
    });

    // Handle Presence updates
    this.channel.on("presence", { event: "sync" }, () => {
      const state = this.channel.presenceState();
      this.emit("presence", state);
      if (typeof onPresenceChange === "function") onPresenceChange(state);
    });

    this.channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        console.log(`[latch-supabase] Subscribed to realtime sync channel (${channelName})`);
        if (userState) {
          await this.channel.track(userState);
        }
      }
    });
  }

  async updatePresence(userState) {
    if (this.channel && userState) {
      try {
        await this.channel.track(userState);
      } catch {
        /* ignore */
      }
    }
  }

  close() {
    if (this.channel && this.client) {
      this.client.removeChannel(this.channel);
      this.channel = null;
    }
  }
}

module.exports = {
  SupabaseSyncAdapter,
};
