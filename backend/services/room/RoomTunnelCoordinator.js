const { loadRoom, saveRoom } = require("../../lib/room");
const { parsePort } = require("../../config/constants");
const { ensureTunnel } = require("../../lib/room");
const { publishSignal, repoKeyFromRemote, GIST_SCOPE_HINT } = require("../../lib/roomSignal");
const { ContextService } = require("../ContextService");

class RoomTunnelCoordinator {
  constructor({ sse, wssRef }) {
    this.sse = sse;
    this.wssRef = wssRef;
    this.tunnelWatchTimer = null;
    this.tunnelMaintainInFlight = null;
    this.lastTunnelProbeAt = 0;
  }

  get wss() {
    return typeof this.wssRef === "function" ? this.wssRef() : this.wssRef;
  }

  stopTunnelWatch() {
    if (this.tunnelWatchTimer) clearInterval(this.tunnelWatchTimer);
    this.tunnelWatchTimer = null;
  }

  startTunnelWatch() {
    if (this.tunnelWatchTimer) return;
    this.tunnelWatchTimer = setInterval(() => this.maintainHostTunnel().catch(() => undefined), 12000);
    if (this.tunnelWatchTimer.unref) this.tunnelWatchTimer.unref();
  }

  async publishAndWatch(room, project) {
    let warning = null;
    try {
      const published = await publishSignal(room, {
        repoKey: repoKeyFromRemote(project?.remoteUrl) || room.repoKey,
        hostLogin: ContextService.currentUser().login,
      });
      if (published?.ok && published.gistId && published.gistId !== room.signalGistId) {
        room.signalGistId = published.gistId;
        saveRoom(room, project?.path || room.projectPath);
      } else if (!published?.ok) {
        warning = GIST_SCOPE_HINT;
      }
    } catch {
      warning = GIST_SCOPE_HINT;
    }
    this.startTunnelWatch();
    return warning;
  }

  async maintainHostTunnel() {
    if (this.tunnelMaintainInFlight) return this.tunnelMaintainInFlight;
    this.tunnelMaintainInFlight = this.maintainHostTunnelOnce().finally(() => {
      this.tunnelMaintainInFlight = null;
    });
    return this.tunnelMaintainInFlight;
  }

  async maintainHostTunnelOnce() {
    const project = ContextService.currentProject();
    const room = loadRoom(project?.path);
    if (room?.role !== "host") {
      this.stopTunnelWatch();
      return;
    }
    const port = parsePort(process.argv);
    let listedUrl = null;
    try {
      const res = await fetch("http://127.0.0.1:4040/api/tunnels");
      if (res.ok) {
        const tunnels = (await res.json()).tunnels || [];
        listedUrl =
          (tunnels.find((t) => String(t.public_url || "").startsWith("https://")) || tunnels[0] || {}).public_url || null;
      }
    } catch {
      listedUrl = null;
    }
    let url = listedUrl;
    if (!listedUrl) {
      const now = Date.now();
      if (now - this.lastTunnelProbeAt < 8000) return;
      this.lastTunnelProbeAt = now;
      url = await ensureTunnel(port);
    }
    if (!url) return;
    if (url === room.url && room.live !== false) {
      if (!room.signalGistId) await this.publishAndWatch(room, project);
      return;
    }
    const previous = room.url;
    room.url = url;
    room.live = true;
    saveRoom(room, project?.path);
    const warning = await this.publishAndWatch(room, project);
    if (previous !== url) console.log(`[latch-room] tunnel is ${url}`);
    if (warning) console.warn(`[latch-room] ${warning}`);
    if (previous !== url) {
      if (this.sse) this.sse.emit("presence", { workspaceId: project?.id, tunnel: url });
      if (this.wss) {
        const { broadcast } = require("../../lib/roomControl");
        broadcast(this.wss, { type: "tunnel", url });
      }
    }
  }
}

module.exports = { RoomTunnelCoordinator };
