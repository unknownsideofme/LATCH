"use strict";

const express = require("express");
const { listNotices, unreadCount, markRead, markAllRead, dismissNotice, dismissByKey } = require("../lib/notices");
const { requireLocal } = require("../middleware/authMiddleware");

function createNoticeRoutes() {
  const router = express.Router();

  router.get("/api/notices", requireLocal, (_req, res) => {
    res.json({ ok: true, notices: listNotices(), unread: unreadCount() });
  });

  router.post("/api/notices/read-all", requireLocal, (_req, res) => {
    res.json({ ok: true, notices: markAllRead(), unread: 0 });
  });

  router.post("/api/notices/:id/read", requireLocal, (req, res) => {
    markRead(req.params.id);
    res.json({ ok: true, notices: listNotices(), unread: unreadCount() });
  });

  router.post("/api/notices/dismiss", requireLocal, (req, res) => {
    if (req.body?.id) dismissNotice(req.body.id);
    else if (req.body?.key) dismissByKey(req.body.key);
    res.json({ ok: true, notices: listNotices(), unread: unreadCount() });
  });

  return router;
}

module.exports = {
  createNoticeRoutes,
};
