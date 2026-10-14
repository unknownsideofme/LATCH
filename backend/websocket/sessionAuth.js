"use strict";

const { loadRoom } = require("../lib/room");
const { authorizeMember, normLogin, isRemoteRequest } = require("../lib/roomAuth");

function authorizeRoomSocket(socket, req) {
  const room = loadRoom();
  const remote = isRemoteRequest(req);
  if (!remote) return { remote: false, login: null, roomId: room?.roomId || null };
  if (room?.role !== "host" || !room.url) {
    socket.close(4403, "not_hosting");
    return null;
  }
  const url = new URL(req.url, "http://localhost");
  const token = req.headers["x-relay-room-token"] || url.searchParams.get("token");
  const member = authorizeMember(room, token);
  if (!member && !room.open) {
    socket.close(4401, "not_a_member");
    return null;
  }
  return { remote: true, login: member?.login || null, roomId: room.roomId || null };
}

function revokedLogin(room, login) {
  const tokens = Array.isArray(room.memberTokens) ? room.memberTokens : [];
  return !tokens.some((t) => normLogin(t.login) === normLogin(login));
}

function sessionValid(session) {
  if (!session?.remote) return true;
  const room = loadRoom();
  if (room?.role !== "host" || !room.url) return false;
  if (session.roomId && room.roomId && session.roomId !== room.roomId) return false;
  if (room.open) return true;
  return Boolean(session.login) && !revokedLogin(room, session.login);
}

module.exports = {
  authorizeRoomSocket,
  sessionValid,
  revokedLogin,
};
