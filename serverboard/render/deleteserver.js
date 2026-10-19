import "dotenv/config";
import { executeCommand } from "../modules/cli/cmdexec.js";

/**
 * Deletes a Render service by its service ID or service Name.
 *
 * @param {string} serviceIdOrName - Service ID (e.g. srv-xxx) or service name.
 * @param {Object} [options={}] - Options for deletion.
 * @param {boolean} [options.confirm=true] - Pass --confirm to execute the deletion (defaults to true).
 * @param {string} [options.output="json"] - Output format ("json", "text", "yaml").
 * @param {Function} [runner=executeCommand] - Command executor function.
 * @returns {Promise<any>}
 */
export async function deleteRenderService(
  serviceIdOrName,
  options = {},
  runner = executeCommand
) {
  if (!serviceIdOrName) {
    throw new Error("serviceIdOrName is required to delete a Render service");
  }

  const { confirm = true, output = "json" } = options;

  const args = ["services", "delete", serviceIdOrName];

  if (confirm) {
    args.push("--confirm");
  }

  args.push("-o", output);

  try {
    const result = await runner("render", args);
    const parsed =
      output === "json" && result.stdout.trim()
        ? JSON.parse(result.stdout)
        : result.stdout;
    return parsed;
  } catch (error) {
    console.error(`Failed to delete Render service '${serviceIdOrName}':`, error.message);
    throw error;
  }
}

// Execute when run directly: `node render/deleteserver.js <serviceIdOrName>`
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith("/render/deleteserver.js") ||
    process.argv[1].endsWith("\\render\\deleteserver.js"));

if (isDirectRun) {
  const targetId = process.argv[2];

  if (!targetId) {
    console.error("Usage: node render/deleteserver.js <serviceId|serviceName>");
    process.exit(1);
  }

  try {
    const result = await deleteRenderService(targetId);
    console.log("Service deleted successfully:", result);
  } catch (err) {
    console.error("Execution failed:", err.message);
    process.exit(1);
  }
}
