"use strict";

const assert = require("node:assert/strict");
const {
  authorizeRoomSocket,
  sessionValid,
  revokedLogin,
} = require("../../../backend/websocket/sessionAuth");

test("sessionAuth: revokedLogin checks room member tokens", () => {
  const room = {
    memberTokens: [
      { login: "alice", token: "tok-1" },
      { login: "Bob", token: "tok-2" },
    ],
  };

  assert.equal(revokedLogin(room, "alice"), false);
  assert.equal(revokedLogin(room, "bob"), false); // case-insensitive
  assert.equal(revokedLogin(room, "charlie"), true);
  assert.equal(revokedLogin({}, "alice"), true);
});

test("sessionAuth: sessionValid validates local and remote sessions", () => {
  // Local session is always valid
  assert.equal(sessionValid({ remote: false }), true);
  assert.equal(sessionValid(null), true);

  // Remote session when not hosting
  assert.equal(sessionValid({ remote: true, login: "alice" }), false);
});

test("sessionAuth: authorizeRoomSocket handles local non-remote request", () => {
  const socket = { close: () => {} };
  const req = {
    headers: { host: "localhost:3001" },
    socket: { remoteAddress: "127.0.0.1" },
    url: "/api/ws",
  };

  const auth = authorizeRoomSocket(socket, req);
  assert.ok(auth);
  assert.equal(auth.remote, false);
});
