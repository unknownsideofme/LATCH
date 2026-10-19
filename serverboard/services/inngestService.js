import { Inngest } from "inngest";
import { config } from "../config/env.js";
import { ProjectModel } from "../models/Project.js";
import { RenderService } from "./renderService.js";

export const inngest = new Inngest({
  id: "serverboard",
  eventKey: config.inngest.eventKey,
  isDev: config.inngest.isDev,
});

// Function 1: Provision Render Service and poll until live
export const createRenderFunction = inngest.createFunction(
  { id: "create-render-service", name: "Provision Render Service", retries: 2, triggers: [{ event: "project/create" }] },
  async ({ event, step }) => {
    const { projectId, payload } = event.data;

    // 1. Mark as creating
    await step.run("mark-creating", () => ProjectModel.update(projectId, { status: "creating" }));

    // 2. Call Render CLI
    const render = await step.run("provision", () => RenderService.createService(payload));
    const renderId = render?.id || render?.service?.id;
    const renderUrl = render?.serviceDetails?.url || render?.url || `https://${payload.name}.onrender.com`;

    // 3. Save IDs and mark deploying
    await step.run("save-render-data", () =>
      ProjectModel.update(projectId, { render_id: renderId, render_url: renderUrl, status: "deploying" })
    );

    // 4. Poll health endpoint until container is live
    if (renderUrl) {
      await step.run("poll-health", async () => {
        const healthUrl = `${renderUrl.replace(/\/$/, "")}/api/health`;
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 10000));
          try {
            const res = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
            if (res.ok) {
              await ProjectModel.update(projectId, { status: "active" });
              return { live: true, attempts: i + 1 };
            }
          } catch {
            /* building/starting */
          }
        }
        return { live: false, timeout: true };
      });
    }

    return { renderId, renderUrl };
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
