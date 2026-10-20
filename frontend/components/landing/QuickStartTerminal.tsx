"use client";

import { useState } from "react";
import { Copy, Check, Terminal } from "lucide-react";

export function QuickStartTerminal() {
  const [copied, setCopied] = useState(false);

  const commands = `npm install -g @latch/cli
latch login
latch init
latch serve`;

  const handleCopy = () => {
    navigator.clipboard.writeText(commands);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-14">
      <div className="rounded-xl bg-card border border-border p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border mb-6">
          <div>
            <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-primary">
              Quick Start
            </span>
            <h2 className="text-xl sm:text-2xl font-[var(--font-display)] font-bold text-foreground mt-0.5">
              Two Commands to Initialize Your Swarm
            </h2>
          </div>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted border border-border hover:border-ring text-xs font-mono text-foreground cursor-pointer transition-colors shadow-sm"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-primary" />
                <span className="text-primary font-semibold">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Copy commands</span>
              </>
            )}
          </button>
        </div>

        {/* Terminal Window */}
        <div className="rounded-lg bg-background border border-border p-4 sm:p-5 font-mono text-xs text-foreground leading-relaxed shadow-inner">
          <div className="flex items-center gap-2 pb-3 border-b border-border mb-3 text-[11px] text-muted-foreground">
            <Terminal className="w-3.5 h-3.5 text-primary" />
            <span>bash / zsh terminal</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-primary font-bold select-none">$</span>
              <span className="text-foreground">npm install -g @latch/cli</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-primary font-bold select-none">$</span>
              <span className="text-foreground">latch login</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-primary font-bold select-none">$</span>
              <span className="text-foreground">latch init</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-primary font-bold select-none">$</span>
              <span className="text-foreground">latch serve</span>
            </div>

            <div className="pt-2 text-muted-foreground text-[11px] space-y-1">
              <div>&gt; [LATCH DAEMON] Initialized on 127.0.0.1:3001</div>
              <div>&gt; [STOP HOOKS] Installed to Cursor, Claude Code, and Codex CLI</div>
              <div className="text-primary font-semibold">&gt; [STATUS] Swarm arbitration ready (0.00% collision guarantee)</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
