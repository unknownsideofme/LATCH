"use strict";

const { getSupabaseClient } = require("../supabase/client");

let intervalTimer = null;

/**
 * Reconciles expired subscriptions atomically in Supabase using the stored PostgreSQL RPC.
 * Multi-instance safe via FOR UPDATE SKIP LOCKED in schema.sql.
 */
async function runSubscriptionReaper({ sse } = {}) {
  const supabase = getSupabaseClient();
  if (!supabase) return { count: 0, notice: "Supabase unconfigured" };

  try {
    const { data: expiredList, error } = await supabase.rpc("reconcile_expired_subscriptions");

    if (error) {
      console.error("[SubscriptionReaper] Error reconciling expired subscriptions:", error.message);
      return { count: 0, error: error.message };
    }

    const count = Array.isArray(expiredList) ? expiredList.length : 0;
    if (count > 0) {
      console.log(`[SubscriptionReaper] Reconciled and downgraded ${count} expired subscription(s)`);

      // Broadcast real-time SSE notifications to connected clients
      if (sse && typeof sse.emit === "function") {
        for (const record of expiredList) {
          sse.emit("entitlement_changed", {
            userId: record.user_id,
            organizationId: record.organization_id,
            planTier: "free",
            projectLimit: 3,
            status: "EXPIRED",
          });
        }
      }
    }

    return { count, expired: expiredList };
  } catch (err) {
    console.error("[SubscriptionReaper] Unexpected error:", err);
    return { count: 0, error: String(err.message || err) };
  }
}

/**
 * Starts the hourly background runner.
 */
function startReaperSchedule({ sse, intervalMs = 60 * 60 * 1000 } = {}) {
  if (intervalTimer) return;

  // Run initial sweep on boot after a brief startup delay (5s)
  setTimeout(() => {
    runSubscriptionReaper({ sse }).catch(() => undefined);
  }, 5000);

  intervalTimer = setInterval(() => {
    runSubscriptionReaper({ sse }).catch(() => undefined);
  }, intervalMs);

  if (typeof intervalTimer.unref === "function") {
    intervalTimer.unref();
  }

  console.log(`[SubscriptionReaper] Scheduled hourly background subscription reaper (Interval: ${intervalMs}ms)`);
}

function stopReaperSchedule() {
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
}

module.exports = {
  runSubscriptionReaper,
  startReaperSchedule,
  stopReaperSchedule,
};
