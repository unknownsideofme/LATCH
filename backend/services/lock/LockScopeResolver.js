const { loadRoom } = require("../../lib/room");
const { loadRegistry } = require("../../lib/store");
const { normalizeCompare } = require("../../lib/transcripts/util");
const { ContextService } = require("../ContextService");

class LockScopeResolver {
  static resolve(projectId) {
    const reg = loadRegistry();
    const current = ContextService.currentProject();
    const project =
      reg.projects.find((p) => p.id === projectId || p.id.toLowerCase() === String(projectId||'').toLowerCase() || (projectId && p.name && p.name.toLowerCase() === String(projectId).toLowerCase()) || (projectId && p.remoteUrl && p.remoteUrl.toLowerCase().includes(String(projectId).toLowerCase())) || normalizeCompare(p.path) === normalizeCompare(projectId)) ||
      (projectId ? null : current);
    if (!project) return null;
    const room = loadRoom(project.path) || loadRoom();
    const aliases = [];
    if (
      room &&
      (room.hostProjectId === project.id ||
        room.projectId === project.id ||
        normalizeCompare(room.projectPath) === normalizeCompare(project.path) ||
        normalizeCompare(room.hostWorkspacePath) === normalizeCompare(project.path))
    ) {
      aliases.push(room.hostWorkspacePath, room.projectPath, room.hostProjectId, room.projectId);
    }
    return { id: project.id, path: project.path, aliases: aliases.filter(Boolean) };
  }

  static peerScoped(body, session) {
    if (!session?.remote) return body;
    const room = loadRoom();
    if (!room?.url || room.role !== "host") return body;
    const shared = loadRegistry().projects.find((p) => p.id === room.hostProjectId) || ContextService.currentProject();
    if (!shared?.path) return body;
    return { ...body, workspaceId: shared.path, peerWorkspacePath: body?.workspaceId || null };
  }
}

module.exports = { LockScopeResolver };
