"use client";

import { useLatch } from "@/lib/LatchContext";
import { MarkdownView, plainPreview } from "@/lib/markdown";
import { Badge } from "@/components/ui/badge";
import ui from "@/styles/ui.module.css";

export function MemoryPanel() {
  const { dashboard } = useLatch();
  if (!dashboard) return null;
  return (
    <>
      <article className={ui.card}>
        <h3 className="font-[var(--mono)] text-sm font-semibold">memory.json</h3>
        <p style={{ color: "var(--muted)", margin: "4px 0 0" }}>
          {dashboard.memory?.historyCount ?? dashboard.history?.length ?? 0} events · {dashboard.memory?.chatCount ?? dashboard.chats.length} chats · {dashboard.memory?.editCount ?? dashboard.edits.length} edits
        </p>
      </article>
      {(dashboard.conflicts || []).map((c) => (
        <article className={ui.card} key={c.file}>
          <h3 className="font-[var(--mono)] text-sm font-semibold text-[var(--red)]">Conflict · {c.file}</h3>
          <p style={{ color: "var(--amber)", margin: "4px 0 0" }}>{c.agents.join(" + ")}</p>
        </article>
      ))}
      {dashboard.timeline.slice(0, 12).map((seg) => (
        <details className={ui.card} key={seg.id}>
          <summary className={ui.rowBetween}>
            <h3>{seg.agent} · {seg.events.length}</h3>
            <Badge
              variant={seg.mine ? "default" : "secondary"}
              className="text-[11px] px-2 py-0.5 font-medium"
            >
              {seg.mine ? "you" : `@${seg.ownerLogin}`}
            </Badge>
          </summary>
          <p className={ui.clamp} style={{ color: "var(--muted)", margin: "8px 0 0" }}>
            {seg.events.map((ev) => ev.file || plainPreview(ev.text || "", 80)).filter(Boolean).slice(0, 3).join(" · ")}
          </p>
          <ul className={ui.memList}>
            {seg.events.map((ev, i) => (
              <li key={i}>{ev.file ? ev.file : <MarkdownView text={ev.text || ""} />}</li>
            ))}
          </ul>
        </details>
      ))}
    </>
  );
}
