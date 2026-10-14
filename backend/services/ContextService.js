"use strict";

const os = require("os");
const { loadRegistry, loadSession } = require("../lib/store");
const { whoami } = require("../lib/githubLogin");
const { fetchCollaborators: fetchGithubCollaborators } = require("../lib/githubRepo");
const { normalizeCompare } = require("../lib/transcripts/util");

class ContextService {
  static currentProject() {
    const reg = loadRegistry();
    const session = loadSession();
    return reg.projects.find((p) => p.id === session.projectId) || reg.projects[0] || null;
  }

  static currentUser() {
    const { session, user } = whoami();
    if (user) {
      return {
        id: user.id,
        login: user.login,
        name: user.name || user.login,
        avatarUrl: user.avatarUrl || `https://github.com/${user.login}.png`,
      };
    }
    const login = session.login || os.userInfo().username || "local";
    return { id: `local_${login}`, login, name: login, avatarUrl: "" };
  }

  static originId() {
    const session = loadSession();
    return `${os.hostname()}:${session.login || "local"}`;
  }

  static sameLogin(a, b) {
    return Boolean(a) && Boolean(b) && String(a).toLowerCase() === String(b).toLowerCase();
  }

  static projectForPath(workspacePath, ensureWorkspaceFn) {
    if (!workspacePath) return null;
    const found = loadRegistry().projects.find((p) => normalizeCompare(p.path) === normalizeCompare(workspacePath));
    if (found) return found;
    return typeof ensureWorkspaceFn === "function" ? ensureWorkspaceFn(workspacePath) : null;
  }

  static overlayTeam(ghList, roomMembers) {
    const roomByLogin = new Map();
    for (const m of roomMembers || []) {
      const key = String(m?.login || "").toLowerCase();
      if (key) roomByLogin.set(key, m);
    }
    const seen = new Set();
    const rows = [];
    for (const gh of ghList || []) {
      const key = String(gh.login || "").toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const live = roomByLogin.get(key);
      const inRoom = Boolean(live);
      rows.push({
        id: gh.id || live?.id || `gh_${gh.login}`,
        login: gh.login,
        name: (inRoom && live.name) || gh.name || gh.login,
        avatarUrl: (inRoom && live.avatarUrl) || gh.avatarUrl || "",
        permission: gh.permission || null,
        source: "github",
        inRoom,
        role: inRoom ? live.role : undefined,
        online: inRoom ? Boolean(live.online) : false,
        agentActive: inRoom ? Boolean(live.agentActive) : false,
        agentLabel: inRoom ? live.agentLabel || null : null,
      });
    }
    for (const live of roomMembers || []) {
      const key = String(live.login || "").toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      rows.push({
        ...live,
        source: "room",
        inRoom: true,
        online: Boolean(live.online),
        agentActive: Boolean(live.agentActive),
        agentLabel: live.agentLabel || null,
      });
    }
    return rows;
  }

  static async collaboratorCheck(project, login) {
    try {
      const list = await fetchGithubCollaborators(project?.remoteUrl);
      const authoritative = list.filter((c) => c.source === "collaborators");
      if (!authoritative.length) return { verified: false, allowed: true, reason: "unverifiable" };
      const match = authoritative.find((c) => ContextService.sameLogin(c.login, login));
      return match
        ? { verified: true, allowed: true, permission: match.permission || null }
        : { verified: true, allowed: false, reason: "not_a_collaborator" };
    } catch {
      return { verified: false, allowed: true, reason: "lookup_failed" };
    }
  }
}

module.exports = {
  ContextService,
};
