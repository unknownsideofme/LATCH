"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const { loadSession } = require("../lib/store");
const { loadRoom } = require("../lib/room");
const { publicRoom } = require("../lib/roomAuth");
const { VERSION, UI_ORIGIN } = require("../config/constants");

const { createAuthRoutes } = require("./authRoutes");
const { createProjectRoutes } = require("./projectRoutes");
const { createLockRoutes } = require("./lockRoutes");
const { createRoomRoutes } = require("./roomRoutes");
const { createPatchRoutes } = require("./patchRoutes");
const { createAgentRoutes } = require("./agentRoutes");
const { createNoticeRoutes } = require("./noticeRoutes");
const { createMcpRoutes } = require("./mcpRoutes");
const { createCentralRoutes } = require("./centralRoutes");

function registerRoutes(app, services) {
  const { sse, watcher, presence, lockTable, lockService, patchService, roomService, transcriptService, workspaceService, guestClient, getCoordPort } = services;

  // Root health endpoint
  app.get("/api/health", (_req, res) => {
    const session = loadSession();
    const { isSupabaseConfigured } = require("../supabase/client");
    res.json({
      ok: true,
      version: VERSION,
      coordinatorPort: typeof getCoordPort === "function" ? getCoordPort() : 0,
      auth: Boolean(session.userId),
      supabase: isSupabaseConfigured(),
      room: publicRoom(loadRoom()),
    });
  });

  // Mount modular sub-routers
  app.use(createAuthRoutes({ sse }));
  app.use(createProjectRoutes({
    sse,
    watcher,
    lockTable,
    lockService,
    patchService,
    roomService,
    transcriptService,
    workspaceService,
    guestClient,
  }));
  app.use(createLockRoutes({
    lockTable,
    lockService,
    roomService,
    sse,
    workspaceService,
  }));
  app.use(createRoomRoutes({
    sse,
    roomService,
    lockService,
    patchService,
    workspaceService,
    guestClient,
  }));
  app.use(createPatchRoutes({
    patchService,
    lockTable,
    workspaceService,
  }));
  app.use(createAgentRoutes({
    sse,
    watcher,
    presence,
    lockTable,
    lockService,
    workspaceService,
    roomService,
  }));
  app.use(createNoticeRoutes());
  app.use(createMcpRoutes());
  app.use(createCentralRoutes({ sse }));

  // Static UI / Dashboard root handler
  const uiDist = path.join(__dirname, "..", "..", "mission-control", "out");
  if (fs.existsSync(uiDist)) {
    app.use(express.static(uiDist));
    app.get("/", (_req, res) => res.sendFile(path.join(uiDist, "index.html")));
  } else {
    app.get("/", (_req, res) => {
      const coordPort = typeof getCoordPort === "function" ? getCoordPort() : 0;
      res.type("html").send(`<!doctype html><html><body style="background:#0b0c0f;color:#e7e7ea;font-family:sans-serif;padding:48px">
        <h1>Relay API</h1>
        <p>Coordinator on 127.0.0.1:${coordPort}. Open Mission Control at <a href="${UI_ORIGIN}" style="color:#f59e0b">${UI_ORIGIN}</a>.</p>
      </body></html>`);
    });
  }
}

module.exports = {
  registerRoutes,
};
