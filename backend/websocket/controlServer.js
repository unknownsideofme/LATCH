"use strict";

const { WebSocketServer } = require("ws");
const { loadRoom } = require("../lib/room");
const { sendSocket } = require("../lib/roomControl");
const { authorizeRoomSocket, sessionValid } = require("./sessionAuth");
const { ContextService } = require("../services/ContextService");
const { MAX_FRAME_BYTES, RPC_BURST } = require("../config/constants");

function createControlServer({ server, lockService, ensureWorkspaceFn }) {
  const wssControl = new WebSocketServer({ server, path: "/ws/control" });

  wssControl.on("error", (err) => {
    if (err.code === "EADDRINUSE") return;
    console.warn(`[latch-ws-control] ${err.message || err}`);
  });

  wssControl.on("connection", (socket, req) => {
    const session = authorizeRoomSocket(socket, req);
    if (!session) return;
    const room = loadRoom();
    if (room?.role === "host" && room.url) {
      const shared =
        lockService.lockScope(room.hostProjectId) ||
        (ContextService.currentProject() ? { id: ContextService.currentProject().id, path: ContextService.currentProject().path } : null);
      if (shared) {
        sendSocket(socket, {
          type: "locks",
          workspaceId: room.hostProjectId || shared.id,
          locks: lockService.locksFor(shared),
          reads: lockService.readsFor(shared),
        });
      }
    }
    const beat = setInterval(() => {
      if (socket.readyState !== 1) return;
      try {
        socket.ping();
        sendSocket(socket, { type: "ping" });
      } catch {
        /* closed */
      }
    }, 12000);
    if (beat.unref) beat.unref();

    socket.on("close", () => clearInterval(beat));

    let windowStart = Date.now();
    let inWindow = 0;

    socket.on("message", async (raw) => {
      try {
        if (raw.length > MAX_FRAME_BYTES) {
          socket.close(4413, "frame_too_large");
          return;
        }
        if (!sessionValid(session)) {
          socket.close(4401, "membership_revoked");
          return;
        }
        const msg = JSON.parse(String(raw));
        if (msg.type === "pong" || msg.type === "ping") {
          if (msg.type === "ping") sendSocket(socket, { type: "pong" });
          return;
        }
        if (msg.type === "join") {
          const hosted = loadRoom();
          const shared =
            lockService.lockScope(hosted?.hostProjectId) ||
            (ContextService.currentProject() ? { id: ContextService.currentProject().id, path: ContextService.currentProject().path } : null);
          if (shared) {
            sendSocket(socket, {
              type: "locks",
              workspaceId: hosted.hostProjectId || shared.id,
              locks: lockService.locksFor(shared),
              reads: lockService.readsFor(shared),
            });
          }
          return;
        }
        if (msg.type !== "rpc") return;
        const now = Date.now();
        if (now - windowStart > 1000) {
          windowStart = now;
          inWindow = 0;
        }
        if (++inWindow > RPC_BURST) {
          sendSocket(socket, { type: "rpc-err", id: msg.id, error: "rate_limited" });
          return;
        }
        try {
          sendSocket(socket, {
            type: "rpc-ok",
            id: msg.id,
            result: await lockService.runLockRpc(msg.op, msg.body, session, ensureWorkspaceFn),
          });
        } catch (err) {
          sendSocket(socket, { type: "rpc-err", id: msg.id, error: err.message || "rpc_failed" });
        }
      } catch {
        /* ignore */
      }
    });
  });

  return wssControl;
}

module.exports = {
  createControlServer,
};
