const fs = require("fs");
const path = require("path");
const { loadRoom } = require("../../lib/room");

const ROOM_COOLDOWN_MS = 30_000;
const roomFailedAt = new Map();

class RoomRoutingStrategy {
  static roomUsable(room) {
    if (!room?.url || room.role !== "guest") return false;
    const failed = roomFailedAt.get(room.url);
    return !failed || Date.now() - failed > ROOM_COOLDOWN_MS;
  }

  static markRoomDown(room) {
    if (room?.url) roomFailedAt.set(room.url, Date.now());
  }

  static canonicalPath(value) {
    if (!value) return "";
    try {
      return fs.realpathSync.native(value).replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
    } catch {
      return path.resolve(String(value)).replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
    }
  }

  static roomPayload(room, workspacePath, payload) {
    if (room?.role !== "guest" || !room.hostWorkspacePath) return payload;
    const local = RoomRoutingStrategy.canonicalPath(room.projectPath);
    const here = RoomRoutingStrategy.canonicalPath(workspacePath);
    if (local && here && local !== here && !here.startsWith(`${local}/`)) {
      const hereRoom = loadRoom(workspacePath);
      if (!hereRoom?.url || hereRoom.url !== room.url) return payload;
    }
    return { ...payload, workspaceId: room.hostWorkspacePath, peerWorkspacePath: workspacePath };
  }
}

module.exports = {
  RoomRoutingStrategy,
  ROOM_COOLDOWN_MS,
  roomFailedAt,
};
