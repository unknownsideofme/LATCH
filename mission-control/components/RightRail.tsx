"use client";

import { useMemo } from "react";
import { useRelay } from "@/lib/RelayContext";
import ui from "@/styles/ui.module.css";

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return count.toLocaleString();
}

export function RightRail() {
  const { dashboard } = useRelay();

  const { totalTokens, avgTokens } = useMemo(() => {
    if (!dashboard) return { totalTokens: 0, avgTokens: 0 };
    let chars = 0;
    for (const h of dashboard.history || []) {
      chars += (h.text || "").length + (h.diff || "").length;
    }
    for (const c of dashboard.chats || []) {
      for (const m of c.messages || []) {
        chars += (m.text || "").length;
      }
    }
    for (const e of dashboard.edits || []) {
      chars += (e.diff || "").length;
    }
    const tokens = Math.max(0, Math.round(chars / 3.8));
    const events = Math.max(1, (dashboard.history || []).length);
    const avg = Math.round(tokens / events);
    return { totalTokens: tokens, avgTokens: avg };
  }, [dashboard?.history, dashboard?.chats, dashboard?.edits]);

  if (!dashboard) return <aside className={ui.right} />;

  const activeLocks = (dashboard.locks || []).filter((l) => !l.released).length;
  const conflictsCount = (dashboard.conflicts || []).length;
  const collisionsPrevented = dashboard.stats?.collisions?.totalSaved ?? 0;

  return (
    <aside className={ui.right}>
      {/* 1. PEOPLE */}
      <section>
        <div className={ui.kicker}>People</div>
        <div className={ui.tags}>
          {dashboard.collaborators.length ? (
            dashboard.collaborators.map((c) => (
              <div
                key={c.id}
                className={`${ui.person} ${c.agentActive ? ui.active : ""}`}
                title={c.online ? "online" : "offline"}
              >
                <img src={c.avatarUrl} alt="" />
                <span>{c.name}</span>
              </div>
            ))
          ) : (
            <p style={{ color: "var(--muted)" }}>Just you</p>
          )}
        </div>
      </section>

      {/* 2. TOKEN USAGE */}
      <section>
        <div className={ui.kicker}>Token Usage</div>
        <div className={ui.statGrid}>
          <div className={ui.statCard}>
            <div className={ui.statLabel}>Total Tokens</div>
            <div className={ui.statValue}>{formatTokens(totalTokens)}</div>
            <div className={ui.statSub}>{totalTokens.toLocaleString()} used</div>
          </div>
          <div className={ui.statCard}>
            <div className={ui.statLabel}>Avg / Event</div>
            <div className={ui.statValue}>{formatTokens(avgTokens)}</div>
            <div className={ui.statSub}>per turn</div>
          </div>
        </div>
      </section>

      {/* 3. CONFLICTS & LOCKS */}
      <section>
        <div className={ui.kicker}>Conflicts & Locks</div>
        <div className={ui.statGrid}>
          <div className={ui.statCard}>
            <div className={ui.statLabel}>Locks Applied</div>
            <div className={ui.statValue}>
              <span className={activeLocks > 0 ? ui.statValueAccent : ""}>
                {activeLocks}
              </span>
            </div>
            <div className={ui.statSub}>
              {activeLocks === 1 ? "1 active lock" : `${activeLocks} active locks`}
            </div>
          </div>
          <div className={ui.statCard}>
            <div className={ui.statLabel}>Conflicts</div>
            <div className={ui.statValue}>
              <span className={conflictsCount > 0 ? ui.statValueWarning : ""}>
                {conflictsCount}
              </span>
            </div>
            <div className={ui.statSub}>
              {collisionsPrevented > 0
                ? `${collisionsPrevented} saved`
                : "0 active collisions"}
            </div>
          </div>
        </div>
      </section>
    </aside>
  );
}
