"use strict";

const { HOOK_ROUTES } = require("../config/constants");

function createHookLogger() {
  return (req, res, next) => {
    if (!HOOK_ROUTES.has(req.path)) return next();
    const body = req.body || {};
    const ws = body.workspacePath || body.workspaceId || "";
    const detail = [
      body.agentId ? `agent=${body.agentId}` : "",
      body.file ? `file=${body.file}` : "",
      Array.isArray(body.files) && body.files.length ? `files=${body.files.join(",")}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    const started = Date.now();
    res.on("finish", () => {
      console.log(
        `[relay-hook] ${req.method} ${req.path} -> ${res.statusCode} (${Date.now() - started}ms) ` +
          `workspace=${ws}${detail ? ` ${detail}` : ""}`
      );
    });
    next();
  };
}

module.exports = {
  createHookLogger,
};
