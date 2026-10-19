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
    LOCKED: "bg-[#3ECF8E]/15 text-[#3ECF8E] border border-[#3ECF8E]/30",
    BLOCKED: "bg-[#DA7756]/15 text-[#DA7756] border border-[#DA7756]/30",
    SYNCED: "bg-[#161B22] text-[#F0F3F6] border border-[#262C34]",
    RELEASED: "bg-[#161B22] text-[#8B949E] border border-[#262C34]",
  };

  const actionIcon: Record<string, React.ReactNode> = {
    LOCKED: <Lock className="w-2.5 h-2.5" />,
    BLOCKED: <AlertOctagon className="w-2.5 h-2.5" />,
    SYNCED: <GitCommit className="w-2.5 h-2.5" />,
    RELEASED: <ShieldCheck className="w-2.5 h-2.5" />,
  };

  return (
    <div className="w-full bg-[#12161C] border border-[#262C34] rounded-lg p-4 sm:p-5 shadow-sm">
      {/* Console Title Bar with macOS dots */}
      <div className="flex items-center justify-between pb-3.5 border-b border-[#262C34] mb-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 mr-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F]/80" />
          </div>
          <Terminal className="w-3.5 h-3.5 text-[#3ECF8E]" />
          <span className="text-xs font-mono font-medium text-[#F0F3F6]">
            latch-daemon telemetry (port 3001)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#3ECF8E] animate-pulse"></span>
          <span className="text-[11px] font-mono text-[#8B949E]">
            Live Socket
          </span>
        </div>
      </div>

      {/* Stream Rows */}
      <div className="space-y-1.5 font-mono text-xs">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 px-3 rounded bg-[#0B0E11] border border-[#262C34] hover:border-[#3ECF8E]/30 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-[#8B949E] text-[10px] shrink-0">
                  {item.time}
                </span>
                <span className="text-[#F0F3F6] font-medium shrink-0">
                  {item.agent}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                    actionStyle[item.action]
                  }`}
                >
                  {actionIcon[item.action]}
                  {item.action}
                </span>
                <span className="text-[#8B949E] truncate text-[11px]">
                  <FileCode className="w-3 h-3 inline mr-1 text-[#3ECF8E]" />
                  {item.file}
                </span>
              </div>

              {item.reason && (
                <span className="text-[11px] text-[#DA7756] sm:text-right shrink-0">
                  // {item.reason}
                </span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
