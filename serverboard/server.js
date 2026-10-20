import { createApp } from "./app.js";
import { config } from "./config/env.js";

const app = createApp();

// Start Server
app.listen(config.port, () => {
  console.log(`\n🚀 Serverboard running [ENV: ${config.envType}] at: http://localhost:${config.port}`);
  console.log(`📡 Health Check:          http://localhost:${config.port}/api/health`);
  console.log(`⚡ Inngest Endpoint:       http://localhost:${config.port}/api/inngest\n`);
});

export default app;
