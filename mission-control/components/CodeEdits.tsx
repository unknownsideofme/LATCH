"use client";

import { useEffect, useState } from "react";
import { useLatch } from "@/lib/LatchContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconX, IconCheck, IconCopy } from "@/components/ui/icons";
import ui from "@/styles/ui.module.css";

function Diff({ text }: { text?: string }) {
  if (!text) {
    return (
      <div className={ui.diff} style={{ color: "var(--muted)" }}>
        No text diff available (empty or binary patch).
      </div>
    );
  }
  const lines = text.split("\n");
  const adds = lines.filter((l) => l.startsWith("+")).length;
  const dels = lines.filter((l) => l.startsWith("-")).length;

  return (
    <div>
      <div className="flex items-center gap-3 text-xs font-mono mb-2 text-[var(--muted)]">
        <span className="text-[var(--diff-add)] font-semibold">+{adds} lines</span>
        <span className="text-[var(--diff-del)] font-semibold">-{dels} lines</span>
        <span>{lines.length} total lines</span>
      </div>
      <div className={ui.diff} style={{ maxHeight: "calc(100vh - 220px)", overflow: "auto" }}>
        {lines.map((line, i) => {
          const isAdd = line.startsWith("+");
          const isDel = line.startsWith("-");
          return (
            <div
              key={i}
              className={isAdd ? ui.add : isDel ? ui.del : ""}
              style={{
                background: isAdd
                  ? "rgba(52, 115, 75, 0.10)"
                  : isDel
                  ? "rgba(181, 63, 63, 0.10)"
                  : "transparent",
                padding: "1px 6px",
                borderRadius: "2px",
              }}
            >
              {line || " "}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CodeEdits() {
  const { dashboard, rewind } = useLatch();
  const patches = dashboard?.patches?.length ? dashboard.patches : dashboard?.edits || [];
  const maxLamport = Math.max(0, ...patches.map((p) => p.lamport || 0));
  const [cursor, setCursor] = useState(dashboard?.lastAppliedLamport || maxLamport);
  const [selectedPatch, setSelectedPatch] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

  // Close slide-out sidebar on Escape key
  useEffect(() => {
    if (!selectedPatch) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedPatch(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedPatch]);

  const copyDiff = () => {
    if (!selectedPatch?.diff) return;
    navigator.clipboard.writeText(selectedPatch.diff);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!patches.length) return <div className={ui.empty}>No patches in this workspace.</div>;

  return (
    <>
      {/* 1. Time Travel Control */}
      <article className={ui.card} style={{ marginBottom: 14 }}>
        <h3>Time travel</h3>
        <p style={{ color: "var(--muted)", marginTop: 0 }}>
          Lamport-ordered micro-patches. Drag to rewind the working tree to that causal cut.
        </p>
        <input
          className={ui.slider}
          type="range"
          min={0}
          max={maxLamport}
          value={cursor}
          onChange={(e) => setCursor(Number(e.target.value))}
        />
        <div className={ui.rowBetween}>
          <span className="font-[var(--mono)] text-xs text-[var(--muted)]">Lamport {cursor}</span>
          <Button
            variant="default"
            size="sm"
            className="h-7 text-xs px-3 font-semibold"
            onClick={() => rewind(cursor)}
          >
            Rewind tree to L{cursor}
          </Button>
        </div>
      </article>

      {/* 2. Patch Items List (Clicking slides out the sidebar) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-[var(--muted)] px-1 mb-2 font-[var(--font-display)] font-semibold uppercase tracking-wider">
          <span>Micro-Patches ({patches.length})</span>
          <span>Click to view diff →</span>
        </div>

        {patches.map((edit) => {
          const isSelected = selectedPatch?.id === edit.id;
          return (
            <div
              key={edit.id}
              className={`${ui.patchItemCard} ${isSelected ? ui.patchItemCardActive : ""}`}
              onClick={() => setSelectedPatch(edit)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setSelectedPatch(edit);
              }}
            >
              <div className={ui.patchItemMeta}>
                <div className={ui.patchItemFile}>
                  {edit.file}
                  {edit.binary ? " · binary" : ""}
                </div>
                <div className={ui.patchItemSub}>
                  <Badge variant="outline" className="font-[var(--mono)] text-[10px] px-1.5 py-0 h-4">
                    L{edit.lamport ?? 0}
                  </Badge>
                  <span>{edit.agent}</span>
                  <span className="text-[var(--faint)]">· {edit.mine ? "you" : `@${edit.ownerLogin}`}</span>
                </div>
              </div>

              <div className={ui.patchItemInspect}>
                <span>Diff</span>
                <span aria-hidden>→</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Slide-out Right Sidebar */}
      <div
        className={`${ui.patchDrawerBackdrop} ${selectedPatch ? ui.patchDrawerBackdropOpen : ""}`}
        onClick={() => setSelectedPatch(null)}
        aria-hidden={!selectedPatch}
      />

      <aside
        className={`${ui.patchDrawer} ${selectedPatch ? ui.patchDrawerOpen : ""}`}
        aria-label="Code patch details"
        aria-hidden={!selectedPatch}
      >
        {selectedPatch && (
          <>
            <div className={ui.patchDrawerHead}>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] font-[var(--font-display)] mb-1">
                  Micro-Patch Inspector
                </div>
                <h3 className={ui.patchDrawerFileTitle}>
                  {selectedPatch.file}
                </h3>
                <div className={ui.patchDrawerMetaRow}>
                  <Badge variant="default" className="text-[10.5px] px-2 py-0 h-5 font-mono font-semibold">
                    L{selectedPatch.lamport ?? 0}
                  </Badge>
                  <Badge
                    variant={selectedPatch.mine ? "default" : "secondary"}
                    className="text-[10.5px] px-2 py-0 h-5"
                  >
                    {selectedPatch.agent} · {selectedPatch.mine ? "you" : `@${selectedPatch.ownerLogin}`}
                  </Badge>
                  {selectedPatch.binary && (
                    <Badge variant="outline" className="text-[10px] px-2 py-0 h-5">
                      Binary SHA
                    </Badge>
                  )}
                </div>
              </div>

              <button
                type="button"
                className={ui.patchDrawerClose}
                onClick={() => setSelectedPatch(null)}
                title="Close drawer (Esc)"
                aria-label="Close drawer"
              >
                <IconX size={16} />
              </button>
            </div>

            <div className={ui.patchDrawerActions}>
              <Button
                variant="default"
                size="sm"
                className="h-8 text-xs font-semibold gap-1.5"
                onClick={() => rewind(selectedPatch.lamport)}
              >
                <span>Rewind tree to L{selectedPatch.lamport}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-medium gap-1.5"
                onClick={copyDiff}
                disabled={!selectedPatch.diff}
              >
                {copied ? (
                  <span className="inline-flex items-center gap-1.5">
                    <IconCheck size={14} /> Copied Diff
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <IconCopy size={14} /> Copy Diff
                  </span>
                )}
              </Button>
            </div>

            <div className={ui.patchDrawerContent}>
              <Diff text={selectedPatch.diff} />
            </div>
          </>
        )}
      </aside>
    </>
  );
}
