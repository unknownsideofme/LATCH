"use strict";

const { WebSocket } = require("ws");
const { loadRoom, saveRoom } = require("../lib/room");
const { savePeerSnapshot } = require("../lib/roomSync");
const { ContextService } = require("../services/ContextService");
const { HOST_BACKOFF_MAX_MS } = require("../config/constants");

class GuestClient {
  constructor({ roomService, patchService, sse }) {
    this.roomService = roomService;
    this.patchService = patchService;
    this.sse = sse;

    this.hostSocket = null;
    this.hostRetryTimer = null;
    this.hostBackoffMs = 200;

    this.controlSocket = null;
    this.controlRetryTimer = null;
    this.controlBackoffMs = 200;
  }

  hostWireOpen() {
    return Boolean(this.hostSocket && this.hostSocket.readyState === WebSocket.OPEN);
  }

  sendToHost(obj) {
    if (!this.hostWireOpen()) return false;
    try {
      this.hostSocket.send(JSON.stringify(obj));
      return true;
    } catch {
      return false;
    }
  }

  connectHostPatches(room) {
    if (!room?.url || room.role !== "guest") return;
    if (this.hostRetryTimer) {
      clearTimeout(this.hostRetryTimer);
      this.hostRetryTimer = null;
    }
    if (this.hostSocket) {
      try {
        this.hostSocket.close();
      } catch {
        /* ignore */
      }
    }
    const wsUrl = `${room.url.replace(/^http/, "ws").replace(/\/$/, "")}/ws/patches${
      room.memberToken ? `?token=${encodeURIComponent(room.memberToken)}` : ""
    }`;
    try {
      this.hostSocket = new WebSocket(wsUrl, {
        headers: {
          "ngrok-skip-browser-warning": "relay",
          ...(room.memberToken ? { "x-relay-room-token": room.memberToken } : {}),
        },
      });
    } catch (err) {
      console.warn(`[relay-room] could not open ${wsUrl}: ${err.message || err}`);
      this.schedulePatchesRetry();
      return;
    }

    let retried = false;
    const schedule = () => {
      if (retried) return;
      retried = true;
      const wait = this.hostBackoffMs;
      this.hostBackoffMs = Math.min(HOST_BACKOFF_MAX_MS, Math.round(this.hostBackoffMs * 1.8));
      this.hostRetryTimer = setTimeout(() => {
        this.hostRetryTimer = null;
        const retry = async () => {
          let latest = loadRoom();
          if (latest?.role !== "guest") return;
          latest = (await this.roomService.refreshGuestRoom(latest)) || latest;
          this.connectHostPatches(latest);
          this.connectHostControl(latest);
        };
        retry().catch(() => undefined);
      }, wait);
      if (this.hostRetryTimer.unref) this.hostRetryTimer.unref();
    };

    this.hostSocket.on("open", () => {
      this.hostBackoffMs = 200;
      try {
        this.hostSocket.send(JSON.stringify({ type: "join" }));
      } catch {
        /* ignore */
      }
      console.log(`[relay-room] streaming room from ${room.url}`);
    });

    this.hostSocket.on("error", (err) => {
      console.warn(`[relay-room] host connection failed (${wsUrl}): ${err.message || err}`);
      schedule();
    });

    this.hostSocket.on("message", (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === "pong" || msg.type === "ping") {
          if (msg.type === "ping") {
            try {
              this.hostSocket.send(JSON.stringify({ type: "pong" }));
            } catch {
              /* ignore */
            }
          }
          return;
        }
        if (msg.type === "tunnel" && msg.url) {
          const current = loadRoom();
          if (current?.role === "guest" && msg.url !== current.url) {
            saveRoom({ ...current, url: msg.url }, current.projectPath);
            const updated = loadRoom();
            this.connectHostPatches(updated);
            this.connectHostControl(updated);
          }
          return;
        }
        if (msg.type === "locks") {
          const current = loadRoom();
          if (msg.workspaceId && current?.hostProjectId && msg.workspaceId !== current.hostProjectId) return;
          this.roomService.roomLocks.accept(msg.locks);
          return;
        }
        if (msg.type === "state" || msg.type === "hello") {
          const project = ContextService.currentProject();
          const current = loadRoom();
          if (project && current?.hostProjectId) {
            savePeerSnapshot(project.id, "host", msg, msg.hostLogin || current.hostLogin || "host");
            if (this.sse) {
              this.sse.emit("history", {
                workspaceId: project.id,
                lastSyncAt: Date.now(),
                chats: msg.chats,
                timeline: msg.timeline,
                activity: msg.activity,
                edits: msg.edits,
                agents: msg.agents,
                from: msg.hostLogin,
              });
            }
          }
          return;
        }
        if (msg.type !== "patch" || !msg.patch) return;
        const result = this.patchService.acceptPeerPatch(
          msg.patch,
          {
            remoteUrl: msg.remoteUrl,
            name: msg.name,
            pathName: msg.pathName,
          },
          { skipIfOrigin: true }
        );
        if (result?.recorded && result.projectId && this.sse) {
          this.sse.emit("patch", {
            workspaceId: result.projectId,
            patch: msg.patch,
            incoming: true,
            edit: this.patchService.editRowFor(msg.patch, false),
            originId: msg.patch.originId,
          });
        }
      } catch {
        /* ignore */
      }
    });

    this.hostSocket.on("close", schedule);
  }

  schedulePatchesRetry() {
    const wait = this.hostBackoffMs;
    this.hostBackoffMs = Math.min(HOST_BACKOFF_MAX_MS, Math.round(this.hostBackoffMs * 1.8));
    this.hostRetryTimer = setTimeout(() => {
      this.hostRetryTimer = null;
      const latest = loadRoom();
      if (latest?.role === "guest") this.connectHostPatches(latest);
    }, wait);
    if (this.hostRetryTimer.unref) this.hostRetryTimer.unref();
  }

  connectHostControl(room) {
    if (!room?.url || room.role !== "guest") return;
    if (this.controlRetryTimer) {
      clearTimeout(this.controlRetryTimer);
      this.controlRetryTimer = null;
    }
    if (this.controlSocket) {
      try {
        this.controlSocket.close();
      } catch {
        /* ignore */
      }
    }
    const wsUrl = `${room.url.replace(/^http/, "ws").replace(/\/$/, "")}/ws/control${
      room.memberToken ? `?token=${encodeURIComponent(room.memberToken)}` : ""
    }`;
    try {
      this.controlSocket = new WebSocket(wsUrl, {
        headers: {
          "ngrok-skip-browser-warning": "relay",
          ...(room.memberToken ? { "x-relay-room-token": room.memberToken } : {}),
        },
      });
    } catch (err) {
      console.warn(`[relay-room] control socket failed: ${err.message || err}`);
      this.scheduleControlRetry();
      return;
    }

    this.roomService.roomControl.attach(this.controlSocket);

    let retried = false;
    const schedule = () => {
      if (retried) return;
      retried = true;
      const wait = this.controlBackoffMs;
      this.controlBackoffMs = Math.min(HOST_BACKOFF_MAX_MS, Math.round(this.controlBackoffMs * 1.8));
      this.controlRetryTimer = setTimeout(() => {
        this.controlRetryTimer = null;
        const latest = loadRoom();
        if (latest?.role === "guest") {
          this.roomService
            .refreshGuestRoom(latest)
            .then((next) => this.connectHostControl(next || latest))
            .catch(() => this.connectHostControl(latest));
        }
      }, wait);
      if (this.controlRetryTimer.unref) this.controlRetryTimer.unref();
    };

    this.controlSocket.on("open", () => {
      this.controlBackoffMs = 200;
      this.roomService.roomControl.send({ type: "join" });
      console.log(`[relay-room] control stream ${room.url}`);
      if (this.roomService.roomControl.queued) {
        const pending = this.roomService.roomControl.queued;
        this.roomService.roomControl
          .flush()
          .then(({ replayed, rejected, requeued }) => {
            console.log(
              `[relay-room] replayed ${replayed.length}/${pending} queued lock ${
                pending === 1 ? "mutation" : "mutations"
              }${rejected.length ? `, ${rejected.length} rejected` : ""}${
                requeued.length ? `, ${requeued.length} held for the next reconnect` : ""
              }`
            );
          })
          .catch((err) => console.warn(`[relay-room] replay failed: ${err.message || err}`));
      }
    });

    this.controlSocket.on("error", (err) => {
      console.warn(`[relay-room] control failed: ${err.message || err}`);
      schedule();
    });

    this.controlSocket.on("message", (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === "ping") {
          this.roomService.roomControl.send({ type: "pong" });
          return;
        }
        if (this.roomService.roomControl.handle(msg)) return;
      } catch {
        /* ignore */
      }
    });

    this.controlSocket.on("close", schedule);
  }

  scheduleControlRetry() {
    const wait = this.controlBackoffMs;
    this.controlBackoffMs = Math.min(HOST_BACKOFF_MAX_MS, Math.round(this.controlBackoffMs * 1.8));
    this.controlRetryTimer = setTimeout(() => {
      this.controlRetryTimer = null;
      const latest = loadRoom();
      if (latest?.role === "guest") this.connectHostControl(latest);
    }, wait);
    if (this.controlRetryTimer.unref) this.controlRetryTimer.unref();
  }

  stop() {
    if (this.hostRetryTimer) clearTimeout(this.hostRetryTimer);
    if (this.controlRetryTimer) clearTimeout(this.controlRetryTimer);
    if (this.hostSocket) {
      try {
        this.hostSocket.close();
      } catch {
        /* ignore */
      }
      this.hostSocket = null;
    }
    if (this.controlSocket) {
      try {
        this.controlSocket.close();
      } catch {
        /* ignore */
      }
      this.controlSocket = null;
    }
  }
}

module.exports = {
  GuestClient,
};
