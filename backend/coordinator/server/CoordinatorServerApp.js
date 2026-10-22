const http = require("http");
const path = require("path");
const { LockTable } = require("../lock/LockTable");
const { locksDirFor, homeLatchDir } = require("../../lib/paths");
const { initTreeSitter } = require("../../lib/treeSitterImports");
const { Presence } = require("../../lib/presence");
const { CoordinatorRouter } = require("./CoordinatorRouter");
const { CoordinatorStateWriter } = require("./CoordinatorStateWriter");
const { PortListener } = require("./PortListener");
const { hardenHttpServer } = require("../../lib/httpServer");

function parseArgs(argv) {
  const args = {
    port: process.env.LATCH_COORDINATOR_PORT || process.env.RELAY_COORDINATOR_PORT || 0,
    workspacePath: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--port") args.port = Number(argv[++i]);
    else if (!a.startsWith("-")) args.workspacePath = a;
  }
  return args;
}

function createCoordinator({ workspacePath, preferredPort } = {}) {
  const locksDir = workspacePath
    ? locksDirFor(workspacePath)
    : path.join(homeLatchDir(), "locks");
  const lockTable = new LockTable({ locksDir, workspacePath });
  lockTable.loadFromDisk();
  lockTable.startCleanup();
  const presence = new Presence();
  const startedAt = Date.now();

  const app = CoordinatorRouter.createRouter({
    lockTable,
    presence,
    workspacePath,
    startedAt,
  });

  const server = hardenHttpServer(http.createServer(app));
  return { app, server, lockTable, presence, preferredPort: Number(preferredPort) || 0 };
}

async function startStandalone() {
  await initTreeSitter();
  const args = parseArgs(process.argv);
  const { app, server, lockTable } = createCoordinator({
    workspacePath: args.workspacePath,
    preferredPort: args.port,
  });
  const port = await PortListener.listen(server, Number(args.port) || 0);
  app.set("port", port);
  CoordinatorStateWriter.writeState(args.workspacePath, port);
  console.log(`[latch-coordinator] listening on 127.0.0.1:${port}`);
  return { port, lockTable, server };
}

module.exports = {
  createCoordinator,
  listen: PortListener.listen,
  writeState: CoordinatorStateWriter.writeState,
  startStandalone,
};
