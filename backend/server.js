#!/usr/bin/env node
"use strict";

require("./config/env");

const http = require("http");
const { createCoordinator, listen, writeState } = require("./coordinator/server");
const { SseHub } = require("./lib/sseHub");
const { seedIfEmpty } = require("./lib/seed");
const { initTreeSitter } = require("./lib/treeSitterImports");
const { WorkspaceWatcher } = require("./lib/watchWorkspace");
const { installProjectHooks, installGlobalHooks } = require("./lib/installHooks");
const { loadRoom, share: shareRoom } = require("./lib/room");
const { loadRegistry } = require("./lib/store");
const { normalizeCompare } = require("./lib/transcripts/util");

const { parsePort, UI_ORIGIN } = require("./config/constants");
const { createApp } = require("./app");
const { ContextService } = require("./services/ContextService");
const { NoticeService } = require("./services/NoticeService");
const { TranscriptService } = require("./services/TranscriptService");
const { WorkspaceService } = require("./services/WorkspaceService");
const { RoomService } = require("./services/RoomService");
const { LockService } = require("./services/LockService");
const { PatchService } = require("./services/PatchService");
const { startReaperSchedule } = require("./jobs/subscriptionReaper");

const { createPatchesServer } = require("./websocket/patchesServer");
const { createControlServer } = require("./websocket/controlServer");
const { GuestClient } = require("./websocket/guestClient");

async function main() {
  await initTreeSitter();
  seedIfEmpty();

  try {
    installGlobalHooks();
  } catch {
    /* global configs are best-effort */
  }

  const sse = new SseHub();
  const watcher = new WorkspaceWatcher();

  // Coordinator instance
  const { app: coordApp, server: coordServer, lockTable, presence } = createCoordinator({
    workspacePath: process.cwd(),
    preferredPort: process.env.LATCH_COORDINATOR_PORT || process.env.RELAY_COORDINATOR_PORT || 0,
  });
  const coordPort = await listen(coordServer, Number(process.env.LATCH_COORDINATOR_PORT || process.env.RELAY_COORDINATOR_PORT || 0));
  coordApp.set("port", coordPort);

  // Supabase Adapters (Distributed locks & Realtime sync)
  const { SupabaseLockAdapter } = require("./supabase/SupabaseLockAdapter");
  const { SupabaseSyncAdapter } = require("./supabase/SupabaseSyncAdapter");
  const supabaseLockAdapter = new SupabaseLockAdapter();
  const supabaseSyncAdapter = new SupabaseSyncAdapter();

  if (supabaseLockAdapter.enabled) {
    console.log("[latch-supabase] Distributed locks & sync active via Supabase Realtime");
    supabaseLockAdapter.subscribe(null, (currentLocks) => {
      sse.emit("locks", { locks: currentLocks });
    });
  }

  // Modular Services
  let wssPatches = null;
  let wssControl = null;

  const noticeService = new NoticeService(sse);

  const lockService = new LockService({
    lockTable,
    sse,
    wssControlRef: () => wssControl,
    onBumpCollision: (projId, kind, detail) => roomService.bumpCollision(projId, kind, detail, (obj) => guestClient?.sendToHost(obj)),
    supabaseLockAdapter,
  });

  const workspaceService = new WorkspaceService({
    sse,
    watcher,
    lockTable,
  });

  const roomService = new RoomService({
    sse,
    lockService,
    noticeService,
    workspaceService,
    wssRef: () => wssPatches,
  });
  lockService.roomLocks = roomService.roomLocks;

  const transcriptService = new TranscriptService({
    sse,
    lockTable,
    onQueueRoomState: (project) => roomService.queueRoomState(project),
    onPushRoomHistory: (room, project) => roomService.pushRoomHistory(room, project, (obj) => guestClient?.sendToHost(obj)),
  });
  workspaceService.transcriptService = transcriptService;

  const patchService = new PatchService({
    sse,
    lockTable,
    noticeService,
    workspaceService,
    wssRef: () => wssPatches,
    sendToHostFn: (obj) => guestClient?.sendToHost(obj),
    onBumpCollision: (projId, kind, detail) => roomService.bumpCollision(projId, kind, detail, (obj) => guestClient?.sendToHost(obj)),
    supabaseSyncAdapter,
  });

  const guestClient = new GuestClient({
    roomService,
    patchService,
    sse,
  });

  // Watcher event binding
  watcher.on("change", (evt) => {
    patchService.handleWatcherChange(evt);
  });

  // LockTable change event binding
  lockTable.on("change", (evt) => {
    const ws = evt?.entry?.workspaceId || evt?.workspaceId;
    const room = loadRoom();
    const curr = ContextService.currentProject();
    const project = ws
      ? loadRegistry().projects.find((p) => normalizeCompare(p.path) === normalizeCompare(ws)) ||
        loadRegistry().projects.find((p) => p.id === room?.hostProjectId) || curr
      : (curr || (room?.hostProjectId ? loadRegistry().projects.find((p) => p.id === room?.hostProjectId) : null));
    const scope = project
      ? lockService.lockScope(project.id)
      : room?.role === "guest" && room.projectId
        ? lockService.lockScope(room.projectId) || { id: room.projectId, path: room.projectPath, aliases: [room.hostWorkspacePath] }
        : null;
    if (!scope?.id) return;
    const locks = lockService.locksFor(scope);
    const reads = lockService.readsFor(scope);
    sse.emit("locks", { workspaceId: scope.id, locks, reads });
    lockService.broadcastLocks(locks, reads);
  });

  // Arm initial registered workspaces
  for (const p of loadRegistry().projects) {
    if (p.path) {
      watcher.watch(p.path, p.id);
      lockTable.track(p.path);
    }
    transcriptService.watchTranscripts(p);
  }

  try {
    installProjectHooks(process.cwd());
  } catch {
    /* ignore */
  }

  // Build Express Application
  const app = createApp({
    sse,
    watcher,
    presence,
    lockTable,
    lockService,
    patchService,
    roomService,
    transcriptService,
    workspaceService,
    guestClient,
    getCoordPort: () => coordPort,
  });

  const port = parsePort(process.argv);
  const server = http.createServer(app);

  // Attach WebSockets
  wssPatches = createPatchesServer({ server, roomService, patchService });
  wssControl = createControlServer({
    server,
    lockService,
    ensureWorkspaceFn: (p) => workspaceService.ensureWorkspace(p),
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `[latch-api] port ${port} is already in use — another \`latch serve\` is running. ` +
          `Leaving its coordinator state untouched.`
      );
      process.exit(1);
    }
    throw err;
  });

  // Start HTTP Server
  server.listen(port, "127.0.0.1", () => {
    writeState(process.cwd(), coordPort, { apiPort: port });
    console.log(`[latch-api] http://127.0.0.1:${port}`);
    console.log(`[latch-coordinator] 127.0.0.1:${coordPort}`);
    console.log(`[latch-ui] ${UI_ORIGIN}`);

    const existingRoom = loadRoom();
    if (existingRoom?.role === "guest") {
      guestClient.connectHostPatches(existingRoom);
      guestClient.connectHostControl(existingRoom);
    }
    if (existingRoom?.url) roomService.syncRoomLocks();
    startReaperSchedule({ sse });

    if (existingRoom?.role === "host") {
      roomService.startTunnelWatch();
      shareRoom(port, roomService.shareExtras(ContextService.currentProject()))
        .then(async (result) => {
          if (!result.ok) {
            console.warn(`[latch-room] could not resume hosting: ${result.hint || result.error}`);
            return;
          }
          const warning = await roomService.publishAndWatch(result.room, ContextService.currentProject());
          console.log(`[latch-room] resumed hosting at ${result.room.url}`);
          if (warning) console.warn(`[latch-room] ${warning}`);
        })
        .catch((err) => console.warn(`[latch-room] resume failed: ${err.message || err}`));
    } else if (existingRoom?.role === "guest") {
      roomService
        .refreshGuestRoom(existingRoom)
        .then((next) => {
          guestClient.connectHostPatches(next || existingRoom);
          guestClient.connectHostControl(next || existingRoom);
        })
        .catch(() => {
          guestClient.connectHostPatches(existingRoom);
          guestClient.connectHostControl(existingRoom);
        });
    }
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

