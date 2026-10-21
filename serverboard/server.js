import { createApp } from "./app.js";
import { config } from "./config/env.js";
import { RenderService } from "./services/renderService.js";

const app = createApp();

// Start Server
app.listen(config.port, async () => {
  console.log(`\n🚀 Serverboard running [ENV: ${config.envType}] at: http://localhost:${config.port}`);
  console.log(`📡 Health Check:          http://localhost:${config.port}/api/health`);
  console.log(`⚡ Inngest Endpoint:       http://localhost:${config.port}/api/inngest\n`);

  if (process.env.RENDER_API_KEY) {
    await RenderService.ensureWorkspace().catch(err => {
      console.warn("[render] Workspace setup on startup:", err.message);
    });
  }
});

export default app;
