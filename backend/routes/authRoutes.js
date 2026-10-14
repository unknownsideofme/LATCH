"use strict";

const express = require("express");
const { loadRegistry, saveRegistry, loadSession, saveSession } = require("../lib/store");
const { authorizeUrl, exchangeCode } = require("../lib/githubOAuth");
const { UI_ORIGIN } = require("../config/constants");
const { ContextService } = require("../services/ContextService");

function createAuthRoutes({ sse }) {
  const router = express.Router();

  router.get("/api/session", (_req, res) => {
    const reg = loadRegistry();
    const session = loadSession();
    const user = session.userId ? reg.users.find((u) => u.id === session.userId) || null : null;
    res.json({
      user,
      users: reg.users,
      projectId: session.projectId || ContextService.currentProject()?.id,
      oauthConfigured: Boolean(process.env.GITHUB_CLIENT_ID),
    });
  });

  router.post("/api/auth/login", (req, res) => {
    const reg = loadRegistry();
    const login = req.body?.login;
    const user = reg.users.find((u) => u.login === login) || reg.users[0];
    const session = { ...loadSession(), userId: user.id, login: user.login };
    saveSession(session);
    if (sse) sse.emit("presence", { workspaceId: ContextService.currentProject()?.id, user });
    res.json({ user });
  });

  router.get("/api/auth/github", (req, res) => {
    const redirect = `${req.protocol}://${req.get("host")}/api/auth/github/callback`;
    const url = authorizeUrl(redirect);
    if (!url) {
      return res.status(501).json({
        error: "oauth_not_configured",
        hint: "Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET",
      });
    }
    res.redirect(url);
  });

  router.get("/api/auth/github/callback", async (req, res) => {
    const redirect = `${req.protocol}://${req.get("host")}/api/auth/github/callback`;
    try {
      const result = await exchangeCode(req.query.code, redirect);
      if (result.error) return res.status(400).json(result);
      const reg = loadRegistry();
      let user = reg.users.find((u) => u.login === result.user.login);
      if (!user) {
        user = result.user;
        reg.users.push(user);
        saveRegistry(reg);
      }
      saveSession({ ...loadSession(), userId: user.id, login: user.login });
      res.redirect(UI_ORIGIN);
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  router.post("/api/auth/logout", (_req, res) => {
    saveSession({ userId: null, login: null, projectId: loadSession().projectId });
    res.json({ ok: true });
  });

  return router;
}

module.exports = {
  createAuthRoutes,
};
