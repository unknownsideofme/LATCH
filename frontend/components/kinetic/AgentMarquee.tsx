"use client";

import Marquee from "react-fast-marquee";
import { Terminal, ShieldCheck, Lock, GitPullRequest, Zap } from "lucide-react";

const events = [
  { agent: "Cursor", action: "LOCKED", file: "src/engine/lock_table.rs", icon: <Lock className="w-3 h-3" /> },
  { agent: "Claude Code", action: "BLOCKED", file: "src/engine/lock_table.rs (held by Cursor)", icon: <Zap className="w-3 h-3" /> },
  { agent: "Antigravity", action: "SYNCED", file: "tests/concurrency_test.py", icon: <GitPullRequest className="w-3 h-3" /> },
  { agent: "Codex CLI", action: "RELEASED", file: "docs/architecture.md", icon: <ShieldCheck className="w-3 h-3" /> },
  { agent: "Copilot Workspace", action: "CLAIMED", file: "crates/latch-ast/src/parser.rs", icon: <Terminal className="w-3.5 h-3.5" /> },
];

export function AgentMarquee() {
  return (
    <div className="w-full border-b border-[#262C34] bg-[#0E1217] py-2 select-none overflow-hidden font-mono text-xs">
      <Marquee speed={35} direction="right" gradient={false} autoFill>
        <div className="flex items-center gap-6 pr-6">
          {events.map((e, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#161B22] border border-[#262C34]"
            >
              <span className="text-[#3ECF8E]">{e.icon}</span>
              <span className="font-medium text-[#F0F3F6]">
                {e.agent}
              </span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                  e.action === "BLOCKED"
                    ? "bg-[#DA7756]/15 text-[#DA7756] border border-[#DA7756]/30"
                    : e.action === "LOCKED"
                    ? "bg-[#3ECF8E]/15 text-[#3ECF8E] border border-[#3ECF8E]/30"
                    : "bg-[#21262D] text-[#8B949E]"
                }`}
              >
                {e.action}
              </span>
              <span className="text-[#8B949E] text-[11px]">{e.file}</span>
            </div>
          ))}
        </div>
      </Marquee>
    </div>
  );
}
