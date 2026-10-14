"use strict";

const { resolveAuth } = require("../lib/centralAuth");
const { loadRoom } = require("../lib/room");
const { authorizeMember, roomToken, isRemoteRequest } = require("../lib/roomAuth");
const { loadRegistry } = require("../lib/store");
const { normalizeCompare } = require("../lib/transcripts/util");

function requireCentral(req, res, next) {
  const auth = resolveAuth(req.headers.authorization);
  if (!auth.ok) return res.status(401).json({ error: "unauthorized" });
  req.central = auth;
  next();
}

function requireLocal(req, res, next) {
  if (isRemoteRequest(req)) return res.status(403).json({ error: "host_only" });
  next();
}

function requireRoomMember(req, res, next) {
  const room = loadRoom();
  const hosting = Boolean(room?.url) && room.role === "host";
  if (hosting) {
    const member = authorizeMember(room, roomToken(req));
    if (member) req.roomMember = member;
  }
  if (!isRemoteRequest(req)) return next();
  if (!hosting) return next();
  if (room.open) return next();
  if (!req.roomMember) {
    return res.status(401).json({
      error: "not_a_member",
      hint: "This room is invite-only. Ask the host to send you an invite link.",
    });
  }
  return next();
}

function httpLockSession(req) {
  const remote = Boolean(req.roomMember) || isRemoteRequest(req);
  return { remote, login: req.roomMember?.login || null, roomId: loadRoom()?.roomId || null };
}

function roomScopedBody(req, body, currentProjectFn) {
  if (!req.roomMember && !isRemoteRequest(req)) return body;
  const room = loadRoom();
  if (!room?.url || room.role !== "host") return body;
  const currentProject = typeof currentProjectFn === "function" ? currentProjectFn() : null;
  const shared = loadRegistry().projects.find((p) => p.id === room.hostProjectId) || currentProject;
  if (!shared?.path) return body;
  if (normalizeCompare(body?.workspaceId) === normalizeCompare(shared.path)) return body;
  return { ...body, workspaceId: shared.path, peerWorkspacePath: body?.workspaceId || null };
}

module.exports = {
  requireCentral,
  requireLocal,
  requireRoomMember,
  httpLockSession,
  roomScopedBody,
};
