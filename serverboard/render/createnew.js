import "dotenv/config";
import { executeCommand } from "../modules/cli/cmdexec.js";

export const DEFAULT_SERVICE_CONFIG = {
  name: "latch-runtime",
  type: "web_service",
  runtime: "docker",
  repo: "https://github.com/unknownsideofme/LATCH",
  branch: "main",
  region: "singapore",
  plan: "free",
  output: "json",
};

export async function createRenderService(config = {}, runner = executeCommand) {
  const mergedConfig = { ...DEFAULT_SERVICE_CONFIG, ...config };

  const args = [
    "services",
    "create",
    "--name",
    mergedConfig.name,
    "--type",
    mergedConfig.type,
    "--runtime",
    mergedConfig.runtime,
    "--repo",
    mergedConfig.repo,
    "--branch",
    mergedConfig.branch,
    "--region",
    mergedConfig.region,
    "--plan",
    mergedConfig.plan,
    "-o",
    mergedConfig.output,
    "--confirm",
  ];

  try {
    const result = await runner("render", args);
    const parsed =
      mergedConfig.output === "json"
        ? JSON.parse(result.stdout)
        : result.stdout;
    return parsed;
  } catch (error) {
    console.error("Render service creation failed:", error.message);
    throw error;
  }
}

// Execute when run directly: `node render/createnew.js`
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith("/render/createnew.js") ||
    process.argv[1].endsWith("\\render\\createnew.js"));

if (isDirectRun) {
  try {
    const service = await createRenderService();
    console.log("Service created successfully:", service);
  } catch (err) {
    console.error("Execution failed:", err.message);
    process.exit(1);
  }
}