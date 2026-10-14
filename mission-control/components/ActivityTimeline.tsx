"use client";

import { useRelay } from "@/lib/RelayContext";
import { AgentLogo, UserAvatar } from "@/components/Identity";
import { MarkdownView, plainPreview } from "@/lib/markdown";
import { Badge } from "@/components/ui/badge";
import ui from "@/styles/ui.module.css";

function timeAgo(ts?: number) {
  if (!ts) return "";
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export function ActivityTimeline() {
  const { dashboard } = useRelay();
  const history = [...(dashboard?.history || [])]
    .filter((ev) => ev.kind !== "thinking")
    .sort((a, b) => b.ts - a.ts);
  if (!history.length) return <div className={ui.empty}>No agent events yet.</div>;
  return (
    <div>
      {history.map((ev) => {
        const body = ev.kind === "code_edit" ? ev.file || ev.path || ev.text : ev.text;
        const formatted = ev.kind !== "code_edit" && /[`*_#>\[]/.test(String(body || ""));
        return (
          <details className={ui.feedDetails} key={ev.id}>
            <summary className={ui.feedRow}>
              <span>
                {ev.kind === "code_edit" ? "✎" : ev.role === "user" ? "›" : <AgentLogo agent={ev.agent} size={14} />}
              </span>
              <div className={ui.feedRowContent}>
                <strong>{ev.agent}</strong>{" "}
                <Badge
                  variant={ev.mine ? "default" : "secondary"}
                  className="text-[10px] px-1.5 py-0 h-4 gap-1 inline-flex items-center font-normal"
                >
                  <UserAvatar login={ev.ownerLogin} size={11} />
                  {ev.mine ? "you" : `@${ev.ownerLogin}`}
                </Badge>{" "}
                {ev.role === "user" ? `You: ${plainPreview(body)}` : plainPreview(body)}
              </div>
              <small className="font-[var(--mono)] text-[11px] text-[var(--muted)]">{timeAgo(ev.ts)}</small>
            </summary>
            {formatted || String(body || "").length > 140 ? (
              <div className={ui.feedBody}>
                {ev.kind === "code_edit" ? body : <MarkdownView text={String(body || "")} />}
              </div>
            ) : null}
          </details>
        );
      })}
    </div>
  );
}
