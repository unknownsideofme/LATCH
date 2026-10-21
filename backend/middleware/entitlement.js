"use strict";

const { getSupabaseClient } = require("../supabase/client");
const { loadSession } = require("../lib/store");

/**
 * Middleware ensuring the authenticated user or team holds an active Pro Swarm entitlement.
 */
function requireProEntitlement(options = {}) {
  return async (req, res, next) => {
    try {
      const session = loadSession();
      const userId = session?.userId || req.headers["x-user-id"];
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized: Session required" });
      }

      const supabase = getSupabaseClient();
      if (!supabase) {
        // Fallback in unconfigured local offline mode
        return next();
      }

      const { data: user } = await supabase
        .from("users")
        .select("plan_tier, project_limit, active_subscription_id")
        .eq("id", userId)
        .maybeSingle();

      if (!user || user.plan_tier !== "pro") {
        return res.status(403).json({
          error: "payment_required",
          message: "LATCH Pro Swarm required for this feature. Upgrade to unlock.",
          upgradeUrl: "/#pricing",
        });
      }

      // Check active subscription dates
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status, payment_status, current_period_end, grace_period_until")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const now = new Date();
      if (sub) {
        const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
        const graceEnd = sub.grace_period_until ? new Date(sub.grace_period_until) : null;

        if (periodEnd && periodEnd > now) {
          // Genuinely paid through
          return next();
        }

        if (graceEnd && graceEnd > now) {
          // Within payment failure grace period
          res.setHeader("X-Latch-Grace-Period-Ending", graceEnd.toISOString());
          return next();
        }

        // Period has ended - trigger synchronous downgrade
        await supabase
          .from("users")
          .update({ plan_tier: "free", project_limit: 3, seats_allocated: 1 })
          .eq("id", userId);

        return res.status(403).json({
          error: "subscription_expired",
          message: "Your Pro Swarm subscription billing period has expired. Please renew.",
          upgradeUrl: "/#pricing",
        });
      }

      return next();
    } catch (err) {
      console.error("Entitlement verification error:", err);
      return res.status(500).json({ error: "Entitlement verification failed" });
    }
  };
}

module.exports = {
  requireProEntitlement,
};
