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
      <div className="rounded-xl bg-[#12161C] border border-[#262C34] p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#262C34] mb-6">
          <div>
            <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-[#3ECF8E]">
              Quick Start
            </span>
            <h2 className="text-xl sm:text-2xl font-[var(--font-display)] font-bold text-[#F0F3F6] mt-0.5">
              Two Commands to Initialize Your Swarm
            </h2>
          </div>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#161B22] border border-[#262C34] hover:border-[#3ECF8E]/40 text-xs font-mono text-[#F0F3F6] cursor-pointer transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#3ECF8E]" />
                <span className="text-[#3ECF8E]">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#8B949E]" />
                <span>Copy commands</span>
              </>
            )}
          </button>
        </div>

        {/* Terminal Window */}
        <div className="rounded-lg bg-[#0B0E11] border border-[#262C34] p-4 sm:p-5 font-mono text-xs text-[#F0F3F6] leading-relaxed">
          <div className="flex items-center gap-2 pb-3 border-b border-[#262C34] mb-3 text-[11px] text-[#8B949E]">
            <Terminal className="w-3.5 h-3.5 text-[#3ECF8E]" />
            <span>bash / zsh terminal</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-[#3ECF8E] font-bold select-none">$</span>
              <span className="text-[#F0F3F6]">npm install -g @latch/cli</span>
              <span className="text-[#8B949E] text-[11px] ml-auto hidden sm:inline">// install global CLI</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[#3ECF8E] font-bold select-none">$</span>
              <span className="text-[#F0F3F6]">latch login</span>
              <span className="text-[#8B949E] text-[11px] ml-auto hidden sm:inline">// authenticate node</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[#3ECF8E] font-bold select-none">$</span>
              <span className="text-[#F0F3F6]">latch init</span>
              <span className="text-[#8B949E] text-[11px] ml-auto hidden sm:inline">// link current repo</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[#3ECF8E] font-bold select-none">$</span>
              <span className="text-[#3ECF8E] font-semibold">latch serve</span>
              <span className="text-[#8B949E] text-[11px] ml-auto hidden sm:inline">// starts daemon on :3001</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
