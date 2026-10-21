"use strict";

const express = require("express");
const { PayPalService } = require("../services/PayPalService");
const { getSupabaseClient } = require("../supabase/client");
const { loadSession } = require("../lib/store");

function createBillingRoutes({ sse } = {}) {
  const router = express.Router();

  // 1. Verify subscription after frontend onApprove
  router.post("/api/billing/paypal/verify-subscription", async (req, res) => {
    try {
      const { subscriptionId, seats = 1, organizationId = null } = req.body || {};
      if (!subscriptionId) {
        return res.status(400).json({ error: "subscriptionId is required" });
      }

      const session = loadSession();
      const userId = session?.userId || req.headers["x-user-id"];
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized: Active user session required" });
      }

      // Retrieve ground truth from PayPal
      const paypalSub = await PayPalService.getSubscription(subscriptionId);
      if (!paypalSub) {
        return res.status(404).json({ error: "Subscription not found on PayPal" });
      }

      // Validate plan ID if configured
      if (PayPalService.proPlanId && paypalSub.plan_id !== PayPalService.proPlanId) {
        return res.status(400).json({
          error: "Invalid plan",
          details: `Expected plan ${PayPalService.proPlanId}, received ${paypalSub.plan_id}`,
        });
      }

      const seatCount = Math.max(1, parseInt(seats, 10) || parseInt(paypalSub.quantity, 10) || 1);
      const subStatus = paypalSub.status; // e.g. 'APPROVAL_PENDING', 'APPROVED', 'ACTIVE'
      let paymentStatus = "pending";
      let isEntitled = false;

      // Check if initial payment has completed
      if (subStatus === "ACTIVE") {
        try {
          const txns = await PayPalService.listSubscriptionTransactions(subscriptionId);
          const hasCompletedSale = txns?.transactions?.some((t) => t.status === "COMPLETED");
          if (hasCompletedSale) {
            paymentStatus = "paid";
            isEntitled = true;
          }
        } catch {
          // If transaction lookup fails or is empty, rely on webhook or pending state
        }
      }

      const supabase = getSupabaseClient();
      let currentPeriodStart = paypalSub.start_time ? new Date(paypalSub.start_time).toISOString() : new Date().toISOString();
      let currentPeriodEnd = paypalSub.billing_info?.next_billing_time
        ? new Date(paypalSub.billing_info.next_billing_time).toISOString()
        : null;

      // Upsert into public.subscriptions
      if (supabase) {
        const { data: subRecord, error: subError } = await supabase
          .from("subscriptions")
          .upsert(
            {
              user_id: userId,
              organization_id: organizationId,
              paypal_subscription_id: subscriptionId,
              plan_id: paypalSub.plan_id,
              status: subStatus,
              payment_status: paymentStatus,
              seats: seatCount,
              payer_email: paypalSub.subscriber?.email_address || null,
              paypal_payer_id: paypalSub.subscriber?.payer_id || null,
              start_time: currentPeriodStart,
              current_period_start: currentPeriodStart,
              current_period_end: currentPeriodEnd,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "paypal_subscription_id" }
          )
          .select()
          .single();

        if (subError) {
          console.error("Failed to upsert subscription in Supabase:", subError);
        }

        // Elevate user if payment is confirmed
        if (isEntitled) {
          await supabase
            .from("users")
            .update({
              plan_tier: "pro",
              project_limit: 50,
              seats_allocated: seatCount,
              active_subscription_id: subRecord?.id || null,
            })
            .eq("id", userId);
        }
      }

      if (sse) {
        sse.emit("billing_updated", { userId, status: subStatus, paymentStatus, isEntitled });
      }

      return res.json({
        ok: true,
        status: subStatus,
        paymentStatus,
        isEntitled,
        currentPeriodEnd,
      });
    } catch (err) {
      console.error("Error verifying subscription:", err);
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 2. Transactional Webhook Endpoint
  router.post("/api/billing/paypal/webhook", async (req, res) => {
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const headers = req.headers;

    // A. Verify Webhook Signature
    try {
      const verifyResult = await PayPalService.verifyWebhookSignature({ headers, rawBody });
      if (!verifyResult.verified) {
        console.warn("PayPal webhook signature verification failed:", verifyResult.reason);
        return res.status(400).json({ error: "Invalid webhook signature" });
      }
    } catch (err) {
      console.error("Webhook verification error:", err);
      return res.status(400).json({ error: err.message });
    }

    const event = req.body || {};
    const eventId = event.id;
    const eventType = event.event_type;
    const resource = event.resource || {};
    const subscriptionId = resource.id || resource.billing_agreement_id;

    if (!eventId || !eventType) {
      return res.status(400).json({ error: "Invalid webhook payload structure" });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      // If Supabase is unconfigured in local mock mode, acknowledge gracefully
      return res.json({ ok: true, notice: "Supabase unconfigured, acknowledged" });
    }

    // B. Transactional Idempotency Check in billing_events
    const { data: existingEvent } = await supabase
      .from("billing_events")
      .select("status")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existingEvent) {
      if (existingEvent.status === "processed") {
        return res.status(200).json({ ok: true, duplicate: true });
      }
      if (existingEvent.status === "processing") {
        return res.status(429).json({ error: "Event currently processing" });
      }
    } else {
      await supabase.from("billing_events").insert({
        event_id: eventId,
        event_type: eventType,
        resource_id: subscriptionId || eventId,
        resource_type: event.resource_type || "subscription",
        summary: event.summary || eventType,
        payload: event,
        status: "processing",
      });
    }

    // C. Process Webhook Event Types
    try {
      switch (eventType) {
        case "BILLING.SUBSCRIPTION.ACTIVATED": {
          const subId = resource.id;
          await supabase
            .from("subscriptions")
            .update({
              status: "ACTIVE",
              updated_at: new Date().toISOString(),
            })
            .eq("paypal_subscription_id", subId);
          break;
        }

        case "PAYMENT.SALE.COMPLETED": {
          const parentSubId = resource.billing_agreement_id;
          if (parentSubId) {
            // Re-fetch next_billing_time from PayPal for authoritative period end
            let nextBillingTime = null;
            try {
              const freshSub = await PayPalService.getSubscription(parentSubId);
              nextBillingTime = freshSub?.billing_info?.next_billing_time;
            } catch {
              /* ignore and fallback */
            }

            const updateFields = {
              payment_status: "paid",
              status: "ACTIVE",
              grace_period_until: null,
              updated_at: new Date().toISOString(),
            };
            if (resource.create_time) {
              updateFields.current_period_start = new Date(resource.create_time).toISOString();
            }
            if (nextBillingTime) {
              updateFields.current_period_end = new Date(nextBillingTime).toISOString();
            }

            const { data: updatedSub } = await supabase
              .from("subscriptions")
              .update(updateFields)
              .eq("paypal_subscription_id", parentSubId)
              .select("user_id, seats")
              .maybeSingle();

            if (updatedSub?.user_id) {
              await supabase
                .from("users")
                .update({
                  plan_tier: "pro",
                  project_limit: 50,
                  seats_allocated: updatedSub.seats || 1,
                })
                .eq("id", updatedSub.user_id);
            }
          }
          break;
        }

        case "BILLING.SUBSCRIPTION.PAYMENT.FAILED": {
          const subId = resource.id;
          const gracePeriod = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
          await supabase
            .from("subscriptions")
            .update({
              payment_status: "failed",
              grace_period_until: gracePeriod,
              updated_at: new Date().toISOString(),
            })
            .eq("paypal_subscription_id", subId);
          break;
        }

        case "BILLING.SUBSCRIPTION.CANCELLED": {
          const subId = resource.id;
          await supabase
            .from("subscriptions")
            .update({
              status: "CANCELLED",
              cancelled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("paypal_subscription_id", subId);
          break;
        }

        case "BILLING.SUBSCRIPTION.SUSPENDED":
        case "BILLING.SUBSCRIPTION.EXPIRED": {
          const subId = resource.id;
          const newStatus = eventType === "BILLING.SUBSCRIPTION.EXPIRED" ? "EXPIRED" : "SUSPENDED";
          const { data: sub } = await supabase
            .from("subscriptions")
            .update({
              status: newStatus,
              payment_status: "failed",
              updated_at: new Date().toISOString(),
            })
            .eq("paypal_subscription_id", subId)
            .select("user_id")
            .maybeSingle();

          if (sub?.user_id) {
            await supabase
              .from("users")
              .update({
                plan_tier: "free",
                project_limit: 3,
                seats_allocated: 1,
              })
              .eq("id", sub.user_id);
          }
          break;
        }

        default:
          break;
      }

      // Mark processed
      await supabase
        .from("billing_events")
        .update({ status: "processed", processed_at: new Date().toISOString() })
        .eq("event_id", eventId);

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("Error executing webhook business logic:", err);
      await supabase
        .from("billing_events")
        .update({ status: "failed", error_message: String(err.message || err) })
        .eq("event_id", eventId);
      return res.status(500).json({ error: "Internal processing error" });
    }
  });

  // 3. Current Subscription Status Endpoint
  router.get("/api/billing/subscription", async (req, res) => {
    try {
      const session = loadSession();
      const userId = session?.userId || req.headers["x-user-id"];
      if (!userId) {
        return res.json({ subscription: null, planTier: "free" });
      }

      const supabase = getSupabaseClient();
      if (!supabase) {
        return res.json({ subscription: null, planTier: "free" });
      }

      const { data: user } = await supabase
        .from("users")
        .select("plan_tier, project_limit, active_subscription_id, seats_allocated")
        .eq("id", userId)
        .maybeSingle();

      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return res.json({
        planTier: user?.plan_tier || "free",
        projectLimit: user?.project_limit || 3,
        seatsAllocated: user?.seats_allocated || 1,
        subscription: subscription || null,
      });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 4. Cancel Subscription Endpoint
  router.post("/api/billing/subscription/cancel", async (req, res) => {
    try {
      const session = loadSession();
      const userId = session?.userId || req.headers["x-user-id"];
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const supabase = getSupabaseClient();
      if (!supabase) {
        return res.status(500).json({ error: "Database not configured" });
      }

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .in("status", ["ACTIVE", "APPROVED"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!sub) {
        return res.status(404).json({ error: "No active subscription found to cancel" });
      }

      // Instruct PayPal to stop future recurring charges
      try {
        await PayPalService.cancelSubscription(
          sub.paypal_subscription_id,
          req.body?.reason || "Cancelled by user via dashboard"
        );
      } catch (err) {
        console.warn("PayPal cancel call warning (may already be cancelled on PayPal):", err.message);
      }

      // Mark cancelled locally; paid access retained until current_period_end
      await supabase
        .from("subscriptions")
        .update({
          status: "CANCELLED",
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id);

      return res.json({
        ok: true,
        message: "Subscription cancelled. Access remains active through paid period.",
        currentPeriodEnd: sub.current_period_end,
      });
    } catch (err) {
      console.error("Cancellation error:", err);
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  return router;
}

module.exports = {
  createBillingRoutes,
};
