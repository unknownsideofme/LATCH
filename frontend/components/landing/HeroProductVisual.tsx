"use client";

import Image from "next/image";
import { Lock, Check, ShieldCheck, RefreshCw, AlertTriangle } from "lucide-react";

export function HeroProductVisual() {
  return (
    <div className="relative w-full max-w-lg mx-auto lg:max-w-none">
      {/* Container with subtle glow and layered panels */}
      <div className="relative rounded-xl bg-card border border-border p-4 sm:p-5 shadow-sm text-card-foreground">
        {/* Top Header of the Mock Cockpit */}
        <div className="flex items-center justify-between pb-3.5 border-b border-border mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F]/80" />
            <span className="text-xs font-mono text-muted-foreground ml-2">
              latch-session: main (3 parallel agents)
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-primary/10 text-primary border border-primary/20">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Synchronized
          </span>
        </div>

        {/* Inner Grid: Left Agent Panel & Right Editor */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
          {/* Active Agents Column */}
          <div className="sm:col-span-5 space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block mb-1">
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
                    ? "bg-accent/50 border-primary/40 text-foreground"
                    : "bg-muted/40 border-border text-muted-foreground"
                }`}
              >
                <div className="w-6 h-6 rounded relative p-0.5 shrink-0 bg-card border border-border">
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
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold truncate text-foreground">{agent.name}</span>
                    {agent.status === "active" ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground truncate block">
                    {agent.task}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Right Editor Preview Column */}
          <div className="sm:col-span-7 bg-muted/30 border border-border rounded p-3 font-mono text-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-border text-[11px] text-muted-foreground mb-2">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-primary" />
                  src/auth/token_engine.ts
                </span>
                <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-bold">
                  LEASE: 18s
                </span>
              </div>

              {/* Code Snippet */}
              <div className="space-y-1 text-[11px] leading-relaxed text-foreground">
                <div className="text-muted-foreground">// Exclusive lock held by Claude Code</div>
                <div>
                  <span className="text-primary font-bold">export async function</span> verifySessionToken(
                </div>
                <div className="pl-3">
                  token: <span className="text-muted-foreground">string</span>
                </div>
                <div>): Promise&lt;SessionRecord&gt; &#123;</div>
                <div className="pl-3 text-primary bg-primary/10 rounded px-1">
                  const lock = await latch.acquireMutex(&quot;auth&quot;);
                </div>
                <div className="pl-3">return await decryptClaims(token, lock);</div>
                <div>&#125;</div>
              </div>
            </div>

            {/* Bottom In-flight Status Pill */}
            <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Check className="w-3 h-3 text-primary" />
                AST Validated
              </span>
              <span>1 lock held · 0 queued</span>
            </div>
          </div>
        </div>

        {/* Floating Mini Overlay Badges */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs">
          <div className="p-2 rounded bg-muted/40 border border-border flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground text-[10px]">Lock Type:</span>
            <span className="text-primary font-semibold text-[11px]">EXCLUSIVE_MUTEX</span>
          </div>

          <div className="p-2 rounded bg-muted/40 border border-border flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground text-[10px]">AST Collision:</span>
            <span className="text-primary font-semibold text-[11px]">0.00% Zero</span>
          </div>

          <div className="p-2 rounded bg-muted/40 border border-border flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground text-[10px]">Sync Pulse:</span>
            <span className="text-foreground font-semibold text-[11px]">0.8ms Local</span>
          </div>
        </div>
      </div>
    </div>
  );
}
