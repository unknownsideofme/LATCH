"use strict";

const fs = require("fs");
const path = require("path");
const { loadRoom } = require("./room");
const { loadRegistry, loadMemory } = require("./store");
const { isSupabaseConfigured } = require("../supabase/client");

function updateLatchContextFiles(workspacePath) {
  const ws = workspacePath || process.cwd();
  const latchDir = path.join(ws, ".latch");
  if (!fs.existsSync(latchDir)) {
    try {
      fs.mkdirSync(latchDir, { recursive: true });
    } catch {
      return;
    }
  }

  const room = loadRoom(ws);
  const reg = loadRegistry();
  const project = reg.projects.find((p) => p.path === ws) || reg.projects[0];
  const memory = project?.id ? loadMemory(project.id) : { agents: [] };
  const dbConfigured = isSupabaseConfigured();

  const isConnected = Boolean(
    room?.url || room?.role === "host" || (memory.agents || []).some((a) => a.status === "connected")
  );
  const role = room?.role || "solo";
  const tunnelUrl = room?.url || "None (local only)";
  const host = room?.hostLogin || (room?.role === "host" ? "You (Host)" : "None");
  const connectedAgents =
    (memory.agents || []).filter((a) => a.status === "connected").map((a) => a.label).join(", ") ||
    "None currently connected";
  const members =
    (room?.members || []).map((m) => `${m.name || m.login} (@${m.login}, ${m.role})`).join(", ") || "Solo";

  const contextMd = `# Latch Team & Distributed Context

- **Connection Status**: ${isConnected ? "CONNECTED TO LATCH ROOM" : "LOCAL / SOLO"}
- **Room Role**: ${role}
- **Host**: ${host}
- **Ngrok Tunnel URL**: ${tunnelUrl}
- **Project**: ${project?.name || path.basename(ws)} (${ws})
- **Database Distributed Locks**: ${dbConfigured ? "Supabase Realtime Sync ACTIVE" : "Local lock table"}
- **Connected Agents**: ${connectedAgents}
- **Team Roster**: ${members}

## Collaboration Rules for AI Agents (Antigravity, Cursor, Claude Code, Codex, Copilot):
1. **File Locks (Mandatory)**:
   - Before modifying or writing ANY file, you MUST acquire an exclusive write lock using MCP tool \`latch_claim_file({ file: "<path>" })\`.
   - If the file is locked by a teammate or peer agent, DO NOT overwrite it. Notify the user of the contention.
2. **Lock Release (Mandatory)**:
   - Immediately after completing your file changes, call MCP tool \`latch_release_file({ file: "<path>" })\` to free the lock.
   - Lifecycle hooks automatically verify leases and clean up lingering locks.
3. **Database Real-Time Synchronization**:
   - All locks, releases, and code changes are synchronized in real-time to the distributed Supabase database and displayed live on Mission Control.
4. **Inspection & History**:
   - Call MCP tool \`latch_room_brief\` or \`latch_status\` at any time to inspect teammate activity, live locks, and recent changes.
   - Report significant architectural decisions with \`latch_report_decision\` and task status updates with \`latch_update_task\`.
`;

  const bootstrapMd = `# Latch Agent Bootstrap

Project: \`${ws}\`
Status: ${isConnected ? "CONNECTED TO LATCH ROOM" : "LOCAL / SOLO"}
Tunnel URL: ${tunnelUrl}
Database: ${dbConfigured ? "Supabase Distributed Locks ACTIVE" : "Local Lock Table"}

## Critical Agent Instructions
1. **Claim before writing**: Always call MCP tool \`latch_claim_file({ file: "path" })\` before creating or editing files.
2. **Release after writing**: Always call MCP tool \`latch_release_file({ file: "path" })\` as soon as file modifications are complete.
3. **Check Team Context**: Read \`.latch/latch_context.md\` and call \`latch_room_brief\` to inspect peer edits and active locks.
`;

  try {
    fs.writeFileSync(path.join(latchDir, "latch_context.md"), contextMd, "utf8");
    fs.writeFileSync(path.join(latchDir, "AGENT_BOOTSTRAP.md"), bootstrapMd, "utf8");
  } catch (err) {
    console.warn("[latch] Could not write latch context files:", err.message);
  }
}

module.exports = { updateLatchContextFiles };
