import express from "express";
import cors from "cors";
import { serve } from "inngest/express";
import { config } from "./config/env.js";
import { inngest, inngestFunctions } from "./services/inngestService.js";
import { errorHandler } from "./middleware/errorHandler.js";
import apiRoutes from "./routes/index.js";

const app = express();

// Middleware: restrict CORS to trusted origin allowlist
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json());

// Request logger
app.use((req, _res, next) => {
  const time = new Date().toISOString().split("T")[1].slice(0, 8);
  console.log(`[${time}] ${req.method} ${req.url}`);
  next();
});

// Health check redirect
app.get("/health", (_req, res) => res.redirect("/api/health"));

// URL normalization (handles /api/v1/projects:id and /api/projects:id -> /.../)
app.use((req, _res, next) => {
  if (req.url.startsWith("/api/v1/projects:")) {
    req.url = req.url.replace("/api/v1/projects:", "/api/v1/projects/");
  } else if (req.url.startsWith("/api/projects:")) {
    req.url = req.url.replace("/api/projects:", "/api/projects/");
  }
  next();
});

// Mount Master API Router
app.use("/api", apiRoutes);

// Mount Inngest Background Queue Webhook Endpoint
app.use(
  "/api/inngest",
  serve({
    client: inngest,
    functions: inngestFunctions,
    signingKey: config.isDev ? undefined : config.inngest.signingKey,
    mode: config.isDev ? "dev" : "cloud",
  })
);

// Centralized Error Handling
app.use(errorHandler);

// Start Server
app.listen(config.port, () => {
  console.log(`\n🚀 Serverboard running [ENV: ${config.envType}] at: http://localhost:${config.port}`);
  console.log(`📡 Health Check:          http://localhost:${config.port}/api/health`);
  console.log(`⚡ Inngest Endpoint:       http://localhost:${config.port}/api/inngest\n`);
});

export default app;
