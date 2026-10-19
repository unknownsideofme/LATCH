"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Lock, AlertOctagon, GitCommit, ShieldCheck, FileCode, Terminal } from "lucide-react";

interface StreamEvent {
  id: string;
  time: string;
  agent: string;
  action: "LOCKED" | "BLOCKED" | "SYNCED" | "RELEASED";
  file: string;
  reason?: string;
}

const mockSequence: StreamEvent[] = [
  { id: "1", time: "14:22:01.082", agent: "Cursor", action: "LOCKED", file: "src/engine/lock_table.rs" },
  { id: "2", time: "14:22:01.194", agent: "Claude Code", action: "BLOCKED", file: "src/engine/lock_table.rs", reason: "Wait for Cursor release (TTL: 14s)" },
  { id: "3", time: "14:22:01.450", agent: "Antigravity", action: "SYNCED", file: "crates/ast/parser.rs" },
  { id: "4", time: "14:22:02.108", agent: "Cursor", action: "RELEASED", file: "src/engine/lock_table.rs" },
  { id: "5", time: "14:22:02.140", agent: "Claude Code", action: "LOCKED", file: "src/engine/lock_table.rs" },
  { id: "6", time: "14:22:02.900", agent: "Codex CLI", action: "SYNCED", file: "frontend/app/layout.tsx" },
  { id: "7", time: "14:22:03.412", agent: "Cursor", action: "BLOCKED", file: "frontend/app/layout.tsx", reason: "Codex active session lock" },
];

export function LiveActivityStream() {
  const [items, setItems] = useState<StreamEvent[]>(mockSequence.slice(0, 4));

  useEffect(() => {
    let index = 4;
    const interval = setInterval(() => {
      const nextItem = {
        ...mockSequence[index % mockSequence.length],
        id: Math.random().toString(36).substring(7),
        time: new Date().toISOString().substring(11, 23),
      };
      setItems((prev) => [nextItem, ...prev.slice(0, 4)]);
      index++;
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  const actionStyle: Record<string, string> = {
    LOCKED: "bg-primary/15 text-primary border border-primary/30",
    BLOCKED: "bg-destructive/15 text-destructive border border-destructive/30",
    SYNCED: "bg-muted text-foreground border border-border",
    RELEASED: "bg-muted text-muted-foreground border border-border",
  };

  const actionIcon: Record<string, React.ReactNode> = {
    LOCKED: <Lock className="w-2.5 h-2.5" />,
    BLOCKED: <AlertOctagon className="w-2.5 h-2.5" />,
    SYNCED: <GitCommit className="w-2.5 h-2.5" />,
    RELEASED: <ShieldCheck className="w-2.5 h-2.5" />,
  };

  return (
    <div className="w-full bg-card border border-border rounded-lg p-4 sm:p-5 shadow-sm text-card-foreground">
      {/* Console Title Bar with macOS dots */}
      <div className="flex items-center justify-between pb-3.5 border-b border-border mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F]/80" />
          <span className="text-xs font-mono text-muted-foreground ml-2">
            latch-telemetry-feed: port 3001
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span>Real-time Causal Bus</span>
        </div>
      </div>

      {/* Stream items */}
      <div className="space-y-2 font-mono text-xs">
        <AnimatePresence initial={false}>
          {items.map((event) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 px-3 rounded bg-muted/40 border border-border hover:border-ring transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] text-muted-foreground">{event.time}</span>
                <span className="font-semibold text-foreground">{event.agent}</span>
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                    actionStyle[event.action]
                  }`}
                >
                  {actionIcon[event.action]}
                  {event.action}
                </span>
                <span className="text-muted-foreground truncate">{event.file}</span>
              </div>

              {event.reason && (
                <span className="text-[10px] text-destructive shrink-0 bg-destructive/10 px-2 py-0.5 rounded border border-destructive/20">
                  {event.reason}
                </span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
