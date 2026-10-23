const { HOST_TIMEOUT_MS } = require("../../config/constants");
const { loadRoom } = require("../../lib/room");

class RoomHttpGateway {
  static async fetchHost(url, pathname, init = {}) {
    const token = init.token === null ? null : init.token || loadRoom()?.memberToken;
    const res = await fetch(`${String(url).replace(/\/$/, "")}${pathname}`, {
      ...init,
      signal: AbortSignal.timeout(init.timeoutMs || HOST_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "relay",
        ...(token ? { "x-latch-room-token": token, "x-relay-room-token": token } : {}),
        ...(init.headers || {}),
      },
    });
    if (!res.ok) {
      const err = new Error(`${pathname} ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res;
  }
}

module.exports = { RoomHttpGateway };
