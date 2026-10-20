import crypto from "node:crypto";
import { supabase } from "../config/supabase.js";
import { config } from "../config/env.js";

/**
 * Verifies Render webhook signature using HMAC-SHA256 with timing-safe comparison.
 */
function verifyRenderSignature(rawBody, headerSignature, secret) {
  if (!headerSignature || !secret) return false;

  // Render format: t=<timestamp>,v1=<signature>
  const parts = Object.fromEntries(
    headerSignature.split(",").map(part => {
      const [k, ...v] = part.split("=");
      return [k.trim(), v.join("=").trim()];
    })
  );

  const timestamp = parts.t;
  const signature = parts.v1 || headerSignature;

  // Construct payload to hash
  const payloadToHash = timestamp ? `${timestamp}.${rawBody}` : rawBody;
  const expectedHash = crypto.createHmac("sha256", secret).update(payloadToHash).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedHash, "hex"));
  } catch {
    return false;
  }
}

export const WebhookController = {
  async handleRender(req, res, next) {
    try {
      // 1. In production, require and verify the webhook signature
      if (config.isProd || config.webhookSecret) {
        if (!config.webhookSecret) {
          console.error("[webhook] Rejected: RENDER_WEBHOOK_SECRET is not configured on the server");
          return res.status(500).json({ error: "webhook_not_configured" });
        }

        const sigHeader = req.headers["render-signature"] || req.headers["x-render-signature"];
        const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);

        if (!sigHeader || !verifyRenderSignature(rawBody, sigHeader, config.webhookSecret)) {
          console.warn("[webhook] Unauthorized: invalid or missing Render webhook signature");
          return res.status(401).json({ error: "invalid_signature" });
        }
      }

      // 2. Parse payload
      const payload = req.body || {};
      const { type, service, deploy } = payload;
      const renderId = service?.id || payload.serviceId;

      if (!renderId) {
        return res.status(200).json({ received: true, message: "Ping acknowledged" });
      }

      let status = null;
      const deployStatus = deploy?.status?.toLowerCase();

      if (type === "deploy_succeeded" || deployStatus === "live") status = "running";
      else if (type === "deploy_failed" || deployStatus === "build_failed" || deployStatus === "update_failed") status = "failed";
      else if (type === "deploy_started" || deployStatus === "build_in_progress" || deployStatus === "update_in_progress") status = "deploying";
      else if (deployStatus === "canceled") status = "canceled";

      if (status) {
        const updateData = { status };
        const url = service?.serviceDetails?.url || service?.url;
        if (url) updateData.render_url = url;

        // 3. Database update wrapped in robust error handling
        const { error } = await supabase.from("projects").update(updateData).eq("render_id", renderId);

        if (error) {
          console.error(`[webhook] Database update failed for service ${renderId}:`, error.message);
          // Return 500 so Render retries delivery
          return res.status(500).json({ error: "database_update_failed", message: error.message });
        }

        console.log(`[webhook] ✔ Service ${renderId} successfully updated to status: '${status}'`);
      }

      res.status(200).json({ received: true, renderId, status });
    } catch (err) {
      next(err);
    }
  },
};
