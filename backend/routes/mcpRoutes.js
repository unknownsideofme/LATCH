"use strict";

const express = require("express");
const { handleRpc: mcpRpc } = require("../mcp/tools");
const { requireRoomMember } = require("../middleware/authMiddleware");
const { isRemoteRequest } = require("../lib/roomAuth");
const { ContextService } = require("../services/ContextService");

function createMcpRoutes() {
  const router = express.Router();

  router.post("/mcp", requireRoomMember, async (req, res) => {
    const project = ContextService.currentProject();
    const remote = isRemoteRequest(req);
    const viewer = req.roomMember?.login || null;
    const ctx = {
      workspace: project?.path,
      projectId: project?.id,
      agentId: `mcp:http:${viewer || (remote ? "guest" : "local")}`,
      user: ContextService.currentUser().login,
      owner: ContextService.currentUser().login,
      readOnly: remote,
      viewer,
    };
    const batch = Array.isArray(req.body);
    const messages = batch ? req.body : [req.body];
    const replies = [];
    for (const msg of messages) {
      try {
        const reply = await mcpRpc(msg, ctx);
        if (reply) replies.push({ jsonrpc: "2.0", id: reply.id, result: reply.result });
      } catch (err) {
        replies.push({ jsonrpc: "2.0", id: msg?.id ?? null, error: { code: -32000, message: err.message } });
      }
    }
    if (!replies.length) return res.status(202).end();
    res.json(batch ? replies : replies[0]);
  });

  router.get("/mcp", (_req, res) => res.status(405).json({ error: "streaming_not_supported" }));
  router.delete("/mcp", (_req, res) => res.status(405).json({ error: "stateless_no_sessions" }));

  return router;
}

module.exports = {
  createMcpRoutes,
};
