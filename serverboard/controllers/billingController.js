import { paypalService } from "../services/paypalService.js";
import { supabaseAdmin } from "../config/supabase.js";

export class BillingController {
  /**
   * POST /api/v1/billing/create-order
   * Creates a One-Time PayPal Order for 30 days of Pro Swarm ($24/seat).
   */
  static async createOrder(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "unauthorized", message: "User session required" });
      }

      const seats = Math.max(1, parseInt(req.body?.seats, 10) || 1);
      const order = await paypalService.createOrder({ seats, userId });

      return res.status(200).json({
        ok: true,
        orderId: order.orderId,
        seats: order.seats,
        amount: order.amount,
        status: order.status,
        approveUrl: order.approveUrl,
      });
    } catch (err) {
      console.error("[billing] Error creating PayPal order:", err);
      return res.status(500).json({
        error: "order_creation_failed",
        message: err.message || "Failed to create PayPal payment order",
      });
    }
  }

  /**
   * POST /api/v1/billing/capture-order
   * Captures the authorized PayPal order, verifies payment, and grants 30 days of Pro access.
   */
  static async captureOrder(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "unauthorized", message: "User session required" });
      }

      const { orderId } = req.body || {};
      if (!orderId) {
        return res.status(400).json({ error: "bad_request", message: "orderId is required" });
      }

      // 1. Idempotency Check: Was this order already processed in database?
      const { data: existingOrder } = await supabaseAdmin
        .from("orders")
        .select("*")
        .eq("paypal_order_id", orderId)
        .maybeSingle();

      if (existingOrder) {
        // Prevent replay attacks by a different user
        if (existingOrder.user_id !== userId) {
          return res.status(409).json({
            error: "order_already_claimed",
            message: "This PayPal order has already been claimed by another account.",
          });
        }

        // Idempotent retry by the same user: return existing entitlement without extending 30-day period
        return res.status(200).json({
          ok: true,
          status: "COMPLETED",
          planTier: "pro",
          projectLimit: 10,
          seats: existingOrder.seats || 1,
          currentPeriodEnd: existingOrder.period_end,
          orderId: existingOrder.paypal_order_id,
          captureId: existingOrder.paypal_capture_id,
        });
      }

      // 2. Capture payment with PayPal
      const captureResult = await paypalService.captureOrder({ orderId });

      if (captureResult.status !== "COMPLETED") {
        return res.status(400).json({
          error: "payment_not_completed",
          message: `PayPal order status is ${captureResult.status}. Expected COMPLETED.`,
          status: captureResult.status,
        });
      }

      // 3. User Ownership Verification: check customId in PayPal purchaseUnit
      const purchaseUnit = captureResult.raw?.purchaseUnits?.[0];
      const customId = purchaseUnit?.customId;
      if (customId && customId !== "anonymous" && customId !== String(userId)) {
        return res.status(403).json({
          error: "order_owner_mismatch",
          message: "This order was initialized for a different user account.",
        });
      }

      // 4. Derive seat count from actual paid amount ($24/seat) rather than trusting client body
      const totalPaid = parseFloat(captureResult.amount) || 24.00;
      const seatCount = Math.max(1, Math.round(totalPaid / 24));

      // 5. 30-Day Pro Access Window
      const periodStart = new Date();
      const periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);

      // 6. Record transaction in orders table
      const { error: orderInsertError } = await supabaseAdmin.from("orders").insert([
        {
          user_id: userId,
          paypal_order_id: captureResult.orderId,
          paypal_capture_id: captureResult.captureId,
          amount: totalPaid,
          currency: captureResult.currency || "USD",
          seats: seatCount,
          status: "COMPLETED",
          payer_email: captureResult.payerEmail,
          paypal_payer_id: captureResult.payerId,
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
        },
      ]);

      if (orderInsertError) {
        console.error("[billing] Error recording order in database:", orderInsertError);
      }

      // 7. Elevate user profile to Pro Swarm with 10 project limit
      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from("users")
        .update({
          plan_tier: "pro",
          project_limit: 10,
          seats_allocated: seatCount,
          current_period_end: periodEnd.toISOString(),
        })
        .eq("id", userId)
        .select()
        .maybeSingle();

      if (updateError) {
        console.error("[billing] Failed to elevate user plan in database:", updateError);
        return res.status(500).json({
          error: "entitlement_update_failed",
          message: "Payment was captured by PayPal, but failed to elevate account to Pro in the database. Please contact support with your orderId.",
          orderId: captureResult.orderId,
          captureId: captureResult.captureId,
        });
      }

      return res.status(200).json({
        ok: true,
        status: "COMPLETED",
        planTier: "pro",
        projectLimit: 10,
        seats: seatCount,
        currentPeriodEnd: periodEnd.toISOString(),
        orderId: captureResult.orderId,
        captureId: captureResult.captureId,
      });
    } catch (err) {
      console.error("[billing] Error capturing PayPal order:", err);
      return res.status(500).json({
        error: "capture_failed",
        message: err.message || "Failed to capture payment on PayPal",
      });
    }
  }

  /**
   * GET /api/v1/billing/status
   * Retrieves active plan tier, expiration countdown, and enforces auto-downgrade when 30 days elapse.
   */
  static async getStatus(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(200).json({ planTier: "free", projectLimit: 2, seats: 1 });
      }

      const { data: user, error } = await supabaseAdmin
        .from("users")
        .select("id, plan_tier, project_limit, seats_allocated, current_period_end")
        .eq("id", userId)
        .maybeSingle();

      if (error || !user) {
        return res.status(200).json({ planTier: "free", projectLimit: 2, seats: 1 });
      }

      const now = new Date();

      // Check if 30-day Pro plan has expired
      if (user.plan_tier === "pro") {
        const periodEnd = user.current_period_end ? new Date(user.current_period_end) : null;
        if (!periodEnd || periodEnd <= now) {
          // Synchronous downgrade back to free tier
          await supabaseAdmin
            .from("users")
            .update({
              plan_tier: "free",
              project_limit: 2,
              seats_allocated: 1,
            })
            .eq("id", userId);

          return res.status(200).json({
            planTier: "free",
            projectLimit: 2,
            seats: 1,
            expired: true,
            expiredAt: user.current_period_end,
          });
        }

        const daysRemaining = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

        return res.status(200).json({
          planTier: "pro",
          projectLimit: user.project_limit || 10,
          seats: user.seats_allocated || 1,
          currentPeriodEnd: user.current_period_end,
          daysRemaining,
          expired: false,
        });
      }

      return res.status(200).json({
        planTier: "free",
        projectLimit: user.project_limit || 2,
        seats: user.seats_allocated || 1,
        expired: false,
      });
    } catch (err) {
      console.error("[billing] Error fetching billing status:", err);
      return res.status(500).json({ error: "server_error", message: err.message });
    }
  }

  /**
   * POST /api/v1/billing/webhook
   * Validates cryptographic signature and processes PayPal order/capture webhook events.
   */
  static async handleWebhook(req, res) {
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const headers = req.headers;

    try {
      const verifyResult = await paypalService.verifyWebhookSignature({ headers, rawBody });
      if (!verifyResult.verified) {
        console.warn("[billing-webhook] Webhook signature verification rejected:", verifyResult.reason);
        return res.status(400).json({ error: "invalid_signature", reason: verifyResult.reason });
      }
    } catch (verifyErr) {
      console.error("[billing-webhook] Verification error:", verifyErr);
      return res.status(400).json({ error: "verification_failed", details: verifyErr.message });
    }

    const event = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const eventId = event?.id;
    const eventType = event?.event_type;
    const resource = event?.resource || {};

    // Record webhook event for idempotency and audit
    if (eventId) {
      try {
        await supabaseAdmin.from("billing_events").upsert(
          {
            event_id: eventId,
            event_type: eventType || "UNKNOWN",
            resource_id: resource.id || eventId,
            resource_type: event?.resource_type || "order",
            payload: event,
            status: "processed",
            processed_at: new Date().toISOString(),
          },
          { onConflict: "event_id" }
        );
      } catch (logErr) {
        console.warn("[billing-webhook] Audit logging note:", logErr.message);
      }
    }

    return res.status(200).json({ ok: true, received: eventType });
  }
}
