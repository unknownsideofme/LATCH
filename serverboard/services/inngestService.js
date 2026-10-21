import { Inngest } from "inngest";
import { config } from "../config/env.js";
import { ProjectModel } from "../models/Project.js";
import { RenderService } from "./renderService.js";

export const inngest = new Inngest({
  id: "serverboard",
  eventKey: config.inngest.eventKey,
});

// Function 1: Provision Render Service and poll until live
export const createRenderFunction = inngest.createFunction(
  {
    id: "create-render-service",
    name: "Provision Render Service",
    retries: 2,
    triggers: [{ event: "project/create" }],
    onFailure: async ({ event }) => {
      const projectId = event.data.event?.data?.projectId;
      if (projectId) {
        await ProjectModel.update(projectId, { status: "failed" }).catch(() => {});
      }
    },
  },
  async ({ event, step }) => {
    const { projectId, payload } = event.data;

    // 1. Mark as deploying
    await step.run("mark-deploying", () => ProjectModel.update(projectId, { status: "deploying" }));

    // 2. Call Render CLI
    const render = await step.run("provision", () => RenderService.createService(payload));
    const renderId = render?.id || render?.service?.id;

    if (!renderId) {
      throw new Error("Render provisioning response missing service id");
    }

    const renderUrl = render?.serviceDetails?.url || render?.url || `https://${payload.name}.onrender.com`;

    // 3. Save IDs and mark deploying
    await step.run("save-render-data", () =>
      ProjectModel.update(projectId, { render_id: renderId, render_url: renderUrl, status: "deploying" })
    );

    // 4. Poll health endpoint using step.sleep so invocations finish promptly
    const healthUrl = `${renderUrl.replace(/\/$/, "")}/api/health`;
    const MAX_CHECKS = 24; // 24 checks * 10s = 4 minutes max

    for (let i = 0; i < MAX_CHECKS; i++) {
      await step.sleep(`wait-health-${i}`, "10s");

      const isLive = await step.run(`check-health-${i}`, async () => {
        try {
          const res = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
          return res.ok || res.status === 200;
        } catch {
          return false;
        }
      });

      if (isLive) {
        await step.run("mark-running", () => ProjectModel.update(projectId, { status: "running" }));
        return { renderId, renderUrl, live: true };
      }
    }

    // If still not live after max checks, mark as failed
    await step.run("mark-timeout-failed", () => ProjectModel.update(projectId, { status: "failed" }));
    return { renderId, renderUrl, live: false };
  }
);

// Function 2: Teardown Render Service
export const deleteRenderFunction = inngest.createFunction(
  { id: "delete-render-service", name: "Teardown Render Service", retries: 2, triggers: [{ event: "project/delete" }] },
  async ({ event, step }) => {
    const { projectId, renderId } = event.data;
    if (renderId) await step.run("delete-render", () => RenderService.deleteService(renderId));
    if (projectId) await step.run("delete-db-project", () => ProjectModel.delete(projectId));
    return { success: true };
  }
);

export const inngestFunctions = [createRenderFunction, deleteRenderFunction];

// Local development worker fallback: executes Render CLI directly when running on localhost
export async function runProvisioningWorker(projectId, payload) {
  try {
    const existing = await ProjectModel.findById(projectId);
    if (!existing || existing.status === "deploying" || existing.status === "running") {
      return;
    }

    console.log(`[worker] 🚀 Starting Render provisioning for project ${projectId} (${payload.name})...`);
    await ProjectModel.update(projectId, { status: "deploying" });

    let render;
    try {
      render = await RenderService.createService(payload);
    } catch (renderErr) {
      if (!process.env.VITEST && (renderErr.code === "ENOENT" || renderErr.message?.includes("ENOENT"))) {
        console.warn(`[worker] ⚠️ Render CLI not installed on host machine (${renderErr.message}). Using local development mock service for ${payload.name}...`);
        render = {
          id: `srv-local-${Date.now().toString(36)}`,
          url: `https://${payload.name}.onrender.com`,
          serviceDetails: { url: `https://${payload.name}.onrender.com` },
        };
      } else {
        throw renderErr;
      }
    }
    const renderId = render?.id || render?.service?.id;
    if (!renderId) throw new Error("Render provisioning response missing service id");

    const renderUrl = render?.serviceDetails?.url || render?.url || `https://${payload.name}.onrender.com`;
    await ProjectModel.update(projectId, { render_id: renderId, render_url: renderUrl, status: "deploying" });
    console.log(`[worker] ✔ Render service created: ${renderId} (${renderUrl})`);

    // If local mock service, wait 4s to demonstrate DEPLOYING state on UI, then mark running
    if (renderId.startsWith("srv-local-")) {
      await new Promise(r => setTimeout(r, 4000));
      await ProjectModel.update(projectId, { status: "running" });
      console.log(`[worker] 🎉 Local development service ${renderId} is now LIVE and marked running!`);
      return;
    }

    // Poll health endpoint in background (36 checks * 10s = 6 minutes for Docker build)
    const healthUrl = `${renderUrl.replace(/\/$/, "")}/api/health`;
    const MAX_CHECKS = 36;
    for (let i = 0; i < MAX_CHECKS; i++) {
      await new Promise(r => setTimeout(r, 10000));
      try {
        const res = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
        if (res.ok || res.status === 200) {
          await ProjectModel.update(projectId, { status: "running" });
          console.log(`[worker] 🎉 Service ${renderId} is now LIVE and marked running!`);
          return;
        }
      } catch {}
    }

    console.log(`[worker] ⚠️ Health check polling finished for ${renderId}`);
  } catch (err) {
    console.error(`[worker] ❌ Provisioning failed for ${projectId}:`, err.message);
    await ProjectModel.update(projectId, { status: "failed" }).catch(() => {});
  }
}

export async function runTeardownWorker(projectId, renderId) {
  if (renderId) {
    console.log(`[worker] 🗑 Tearing down Render service ${renderId}...`);
    try {
      await RenderService.deleteService(renderId);
      console.log(`[worker] ✔ Render service ${renderId} deleted`);
    } catch (renderErr) {
      const msg = renderErr?.message || "";
      const isNotFound = /not found|does not exist|404/i.test(msg);
      if (!isNotFound) {
        console.error(`[worker] ❌ Render deletion failed:`, msg);
        throw new Error(`Failed to delete Render service: ${msg}`);
      }
      console.warn(`[worker] ⚠️ Render service ${renderId} already removed on Render:`, msg);
    }
  }

  if (projectId) {
    await ProjectModel.delete(projectId);
    console.log(`[worker] ✔ Project ${projectId} removed from database`);
  }
  return { success: true };
}
