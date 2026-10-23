const fs = require("fs");
const path = require("path");
const os = require("os");
const { normalizeWorkspaceRoot } = require("../../lib/transcripts/util");
const { loadRegistry, loadSession } = require("../../lib/store");
const { SEED_TIMEOUT_MS } = require("../../config/constants");
const { writeTree } = require("../../lib/repoSnapshot");
const { computePatch, recordPatch } = require("../../lib/patches");
const { repoKeyFromRemote, findSignal } = require("../../lib/roomSignal");
const { ContextService } = require("../ContextService");
const { RoomHttpGateway } = require("./RoomHttpGateway");

class RoomJoinResolver {
  static defaultJoinDir(name) {
    return path.join(os.homedir(), "Documents", "Latch", String(name || "workspace").replace(/[<>:"|?*]/g, "-"));
  }

  static decodeParam(value) {
    if (!value) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  static splitInviteUrl(raw) {
    const text = String(raw || "").trim();
    const grab = (name) => {
      const m = text.match(new RegExp(`[?&#]${name}=([^&#\\s]+)`));
      return m ? RoomJoinResolver.decodeParam(m[1]) : null;
    };
    const code = grab("latch_invite") || grab("relay_invite");
    const host = grab("latch_host") || grab("relay_host");
    const repo = grab("latch_repo") || grab("relay_repo");
    const roomId = grab("latch_room") || grab("relay_room");
    let url = text;
    const first = text.search(/[?&#](latch|relay)_(invite|host|repo|room)=/);
    if (first >= 0) url = text.slice(0, first).replace(/[?#]$/, "").replace(/\/$/, "");
    if (!/^https?:\/\//i.test(url)) url = "";
    return { url, code, host, repo, roomId };
  }

  static resolveJoinProject(hostMeta, explicitPath, workspaceService) {
    const reg = loadRegistry();
    if (explicitPath) {
      const resolved = normalizeWorkspaceRoot(explicitPath) || explicitPath;
      fs.mkdirSync(resolved, { recursive: true });
      return workspaceService ? workspaceService.ensureWorkspace(resolved) : null;
    }
    const match =
      (hostMeta.remoteUrl && reg.projects.find((p) => p.remoteUrl && p.remoteUrl === hostMeta.remoteUrl)) ||
      (hostMeta.name && reg.projects.find((p) => p.name === hostMeta.name)) ||
      (hostMeta.pathName && reg.projects.find((p) => path.basename(p.path) === hostMeta.pathName));
    if (match) return match;
    const target = RoomJoinResolver.defaultJoinDir(hostMeta.pathName || hostMeta.name);
    fs.mkdirSync(target, { recursive: true });
    return workspaceService ? workspaceService.ensureWorkspace(target) : null;
  }

  static async resolveJoinTarget(body) {
    const parsed = RoomJoinResolver.splitInviteUrl(body?.url);
    const code = body?.code || parsed.code;
    const hostLogin = body?.hostLogin || parsed.host;
    const repoKey = body?.repoKey || parsed.repo || repoKeyFromRemote(ContextService.currentProject()?.remoteUrl);
    const roomId = body?.roomId || parsed.roomId;
    let url = parsed.url;
    if (!url && body?.url && /^https?:\/\//i.test(String(body.url).trim())) {
      url = String(body.url).replace(/\/$/, "");
    }
    const lookup = () =>
      findSignal({
        gistId: body?.gistId,
        hostLogin,
        repoKey,
        roomId,
      });
    let signal = null;
    if (url) {
      try {
        await RoomHttpGateway.fetchHost(url, "/api/health", { token: null, timeoutMs: 4000 });
      } catch {
        signal = await lookup().catch(() => null);
        if (signal?.url) url = signal.url;
        else {
          const err = new Error("unreachable");
          err.status = 502;
          throw err;
        }
      }
    } else {
      signal = await lookup();
      if (!signal?.url) return { error: "room_not_found", hint: "The host is not sharing right now." };
      url = signal.url;
    }
    if (!signal && (hostLogin || body?.gistId)) {
      signal = await lookup().catch(() => null);
    }
    return { url, code, signal, hostLogin, repoKey, roomId };
  }

  static async seedFromHost(url, hostProjectId, project, applyingRemote) {
    const snap = await RoomHttpGateway.fetchHost(
      url,
      `/api/snapshot?full=1&projectId=${encodeURIComponent(hostProjectId || "")}`,
      { timeoutMs: SEED_TIMEOUT_MS }
    ).then((r) => r.json());
    if (applyingRemote) applyingRemote.add(project.id);
    let written = [];
    let failed = [];
    try {
      ({ written, failed } = writeTree(project.path, snap.files || []));
    } finally {
      if (applyingRemote) applyingRemote.delete(project.id);
    }
    const session = loadSession();
    for (const file of written) {
      const patch = computePatch({
        workspacePath: project.path,
        file,
        agent: "seed",
        ownerLogin: session.login || "local",
        workspaceId: project.id,
      });
      if (patch) {
        patch.originId = ContextService.originId();
        recordPatch(project.id, patch);
      }
    }
    return { files: written.length, failed: failed.length, truncated: Boolean(snap.truncated) };
  }
}

module.exports = { RoomJoinResolver };
