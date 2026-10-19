"use client";

import Image from "next/image";
import { Lock, Check, ShieldCheck, RefreshCw, AlertTriangle } from "lucide-react";

export function HeroProductVisual() {
  return (
    <div className="relative w-full max-w-lg mx-auto lg:max-w-none">
      {/* Container with subtle glow and layered panels */}
      <div className="relative rounded-xl bg-[#12161C] border border-[#262C34] p-4 sm:p-5 shadow-2xl">
        {/* Top Header of the Mock Cockpit */}
        <div className="flex items-center justify-between pb-3.5 border-b border-[#262C34] mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F]/80" />
            <span className="text-xs font-mono text-[#8B949E] ml-2">
              latch-session: main (3 parallel agents)
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#3ECF8E]/15 text-[#3ECF8E] border border-[#3ECF8E]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3ECF8E] animate-pulse" />
            Synchronized
          </span>
        </div>

        {/* Inner Grid: Left Agent Panel & Right Editor */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
          {/* Active Agents Column */}
          <div className="sm:col-span-5 space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#8B949E] block mb-1">
              Active Agents
            </span>

            {[
              { name: "Claude Code", task: "editing auth.ts", img: "/agents/claude.png", status: "active" },
              { name: "Cursor", task: "running tests", img: "/agents/cursor.png", status: "idle" },
              { name: "Copilot", task: "refactoring ui/", img: "/agents/copilot.png", status: "idle" },
              { name: "Codex CLI", task: "updating deps", img: "/agents/codex.png", status: "idle" },
            ].map((agent, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 p-2 rounded border transition-colors ${
                  agent.status === "active"
                    ? "bg-[#161B22] border-[#3ECF8E]/40"
                    : "bg-[#0B0E11] border-[#262C34]"
                }`}
              >
                <div className="w-6 h-6 rounded relative p-0.5 shrink-0 bg-[#12161C] border border-[#262C34]">
                  <Image
                    src={agent.img}
                    alt={agent.name}
                    fill
                    sizes="24px"
                    className="object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-medium text-[#F0F3F6] block truncate leading-tight">
                    {agent.name}
                  </span>
                  <span
                    className={`text-[10px] truncate block font-mono ${
                      agent.status === "active" ? "text-[#3ECF8E]" : "text-[#8B949E]"
                    }`}
                  >
                    {agent.task}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Code Editor Window with Lock Banner */}
          <div className="sm:col-span-7 bg-[#0B0E11] border border-[#262C34] rounded p-3 font-mono text-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-[#262C34] mb-2.5">
                <span className="text-xs text-[#F0F3F6] font-medium">
                  src/auth.ts
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[#3ECF8E]/15 text-[#3ECF8E] border border-[#3ECF8E]/30 font-semibold">
                  <Lock className="w-2.5 h-2.5" />
                  Locked by Claude
                </span>
              </div>

              <div className="space-y-1 text-[#8B949E] text-[11px] leading-relaxed">
                <div>
                  <span className="text-[#484F58] mr-2">1</span>
                  <span className="text-[#DA7756]">export async function</span> <span className="text-[#3ECF8E]">getSession</span>() &#123;
                </div>
                <div>
                  <span className="text-[#484F58] mr-2">2</span>
                  &nbsp;&nbsp;<span className="text-[#DA7756]">const</span> session = <span className="text-[#DA7756]">await</span> auth();
                </div>
                <div>
                  <span className="text-[#484F58] mr-2">3</span>
                  &nbsp;&nbsp;<span className="text-[#DA7756]">return</span> session;
                </div>
                <div>
                  <span className="text-[#484F58] mr-2">4</span>
                  &#125;
                </div>
              </div>
            </div>

            <div className="mt-4 pt-2 border-t border-[#262C34] flex items-center justify-between text-[10px] text-[#8B949E]">
              <span>Cursor lock request: paused</span>
              <span className="text-[#3ECF8E]">TTL: 14s</span>
            </div>
          </div>
        </div>

        {/* Floating Notification Pills Stack */}
        <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="p-2 rounded bg-[#0B0E11] border border-[#262C34] flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-[11px] text-[#F0F3F6]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3ECF8E]" />
              Write Lock
            </span>
            <code className="text-[10px] text-[#8B949E] font-mono">auth.ts</code>
          </div>

          <div className="p-2 rounded bg-[#0B0E11] border border-[#262C34] flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-[11px] text-[#F0F3F6]">
              <RefreshCw className="w-3 h-3 text-[#3ECF8E]" />
              Patch Sync
            </span>
            <span className="text-[10px] text-[#3ECF8E] font-mono">3 files</span>
          </div>

          <div className="p-2 rounded bg-[#0B0E11] border border-[#262C34] flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-[11px] text-[#F0F3F6]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#3ECF8E]" />
              Collision
            </span>
            <span className="text-[10px] text-[#3ECF8E] font-mono">0 Avoided</span>
          </div>
        </div>
      </div>
    </div>
  );
}
