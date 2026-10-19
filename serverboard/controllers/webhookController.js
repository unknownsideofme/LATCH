import { supabase } from "../config/supabase.js";
import { config } from "../config/env.js";

export const WebhookController = {
  async handleRender(req, res) {
    if (config.webhookSecret) {
      const sig = req.headers["x-render-signature"] || req.query.secret;
      if (sig !== config.webhookSecret) return res.status(401).json({ error: "invalid_signature" });
    }

    const { type, service, deploy } = req.body || {};
    const renderId = service?.id || req.body?.serviceId;
    if (!renderId) return res.status(200).json({ received: true });

    let status = null;
    const deployStatus = deploy?.status?.toLowerCase();

    if (type === "deploy_succeeded" || deployStatus === "live") status = "active";
    else if (type === "deploy_failed" || deployStatus === "build_failed") status = "failed";
    else if (type === "deploy_started" || deployStatus === "build_in_progress") status = "deploying";

    if (status) {
      const updateData = { status };
      const url = service?.serviceDetails?.url || service?.url;
      if (url) updateData.render_url = url;

      await supabase.from("projects").update(updateData).eq("render_id", renderId);
      console.log(`[webhook] Service ${renderId} updated to status: ${status}`);
    }

    res.status(200).json({ received: true, renderId, status });
  },
};
