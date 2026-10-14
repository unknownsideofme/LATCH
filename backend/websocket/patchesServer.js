"use strict";

const { WebSocketServer } = require("ws");
const { loadRoom } = require("../lib/room");
const { loadRegistry } = require("../lib/store");
const { sendSocket } = require("../lib/roomControl");
const { authorizeRoomSocket, sessionValid } = require("./sessionAuth");
const { ContextService } = require("../services/ContextService");

function createPatchesServer({ server, roomService, patchService }) {
  const wss = new WebSocketServer({ server, path: "/ws/patches" });

  wss.on("error", (err) => {
    if (err.code === "EADDRINUSE") return;
    console.warn(`[relay-ws] ${err.message || err}`);
  });

  wss.on("connection", (socket, req) => {
    const session = authorizeRoomSocket(socket, req);
    if (!session) return;
    const room = loadRoom();
    if (room?.role === "host" && room.url) {
      const project = ContextService.currentProject();
      if (project) {
        setImmediate(() => sendSocket(socket, roomService.roomStatePayload(project, "hello")));
      }
    }
    const beat = setInterval(() => {
      if (socket.readyState !== 1) return;
      try {
        socket.ping();
        socket.send(JSON.stringify({ type: "ping" }));
      } catch {
        /* closed */
      }
    }, 15000);
    if (beat.unref) beat.unref();

    socket.on("close", () => clearInterval(beat));

    socket.on("message", (raw) => {
      try {
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
          const project = ContextService.currentProject();
          if (project && loadRoom()?.role === "host") {
            sendSocket(socket, roomService.roomStatePayload(project, "hello"));
          }
          return;
        }
        if (msg.type === "history") {
          const project = msg.projectId
            ? loadRegistry().projects.find((p) => p.id === msg.projectId) || ContextService.currentProject()
            : ContextService.currentProject();
          const login = session.remote ? session.login : String(msg.login || "").trim();
          if (!login) return;
          roomService.ingestPeerHistory(login, msg.snapshot, project);
          return;
        }
        if (msg.type === "patch" && msg.patch) {
          patchService.acceptPeerPatch(
            msg.patch,
            {
              remoteUrl: msg.remoteUrl,
              name: msg.name,
              pathName: msg.pathName,
            },
            { skipIfOrigin: true }
          );
          patchService.broadcastPatch({
            workspaceId: msg.workspaceId,
            patch: msg.patch,
            incoming: true,
            remoteUrl: msg.remoteUrl,
            name: msg.name,
            pathName: msg.pathName,
            originId: msg.patch.originId,
          });
        }
      } catch {
        /* ignore malformed */
      }
    });
  });

  return wss;
}

module.exports = {
  createPatchesServer,
};
