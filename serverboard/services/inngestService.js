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

    // 1. Mark as creating
    await step.run("mark-creating", () => ProjectModel.update(projectId, { status: "creating" }));

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
        await step.run("mark-active", () => ProjectModel.update(projectId, { status: "active" }));
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
    if (projectId) await step.run("mark-deleted", () => ProjectModel.update(projectId, { status: "deleted" }));
    return { success: true };
  }
);

export const inngestFunctions = [createRenderFunction, deleteRenderFunction];
