import { Router } from "express";
import authRoutes from "./authRoutes.js";
import projectRoutes from "./projectRoutes.js";
import githubRoutes from "./githubRoutes.js";
import webhookRoutes from "./webhookRoutes.js";
import { checkDbHealth } from "../config/supabase.js";

const api = Router();

api.get("/health", async (_req, res) => {
  const db = await checkDbHealth();
  res.json({
    status: "ok",
    service: "serverboard-api",
    database: db.ok ? "connected" : "error",
    dbLatencyMs: db.latencyMs,
    uptimeSec: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Version 1 (v1) API routes
api.use("/v1/projects", projectRoutes);
api.use("/v1/auth", authRoutes);
api.use("/v1/github", githubRoutes);

// Backwards-compatible aliases
api.use("/projects", projectRoutes);
api.use("/auth", authRoutes);
api.use("/github", githubRoutes);
api.use("/webhooks", webhookRoutes);

export default api;
