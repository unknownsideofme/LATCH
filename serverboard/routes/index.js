import { Router } from "express";
import authRoutes from "./authRoutes.js";
import projectRoutes from "./projectRoutes.js";
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

api.use("/auth", authRoutes);
api.use("/projects", projectRoutes);
api.use("/webhooks", webhookRoutes);

export default api;
