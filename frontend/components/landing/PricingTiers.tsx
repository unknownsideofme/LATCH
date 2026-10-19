"use client";

import Link from "next/link";
import { DecoButton } from "@/components/deco/DecoButton";
import { Check, Sparkles, Terminal } from "lucide-react";

export function PricingTiers() {
  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-16">
      {/* Header */}
      <div className="text-center max-w-xl mx-auto mb-10">
        <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-[#3ECF8E]">
          Access Tiers
        </span>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-[var(--font-display)] font-bold text-[#F0F3F6] mt-1 tracking-tight">
          Start for Free. Scale with Your Swarm.
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-[#8B949E] font-[var(--font-body)]">
          Free and open-source for solo engineers. Cloud state persistence and telemetry for engineering teams.
        </p>
      </div>

      {/* Grid of Two Tiers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Tier I: Free Community */}
        <div className="relative bg-[#12161C] border border-[#262C34] rounded-lg p-6 sm:p-7 flex flex-col justify-between hover:border-[#3ECF8E]/40 transition-colors">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-[#262C34] mb-6">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#8B949E]">
                  Tier 01 // Solo
                </span>
                <h3 className="text-xl font-[var(--font-display)] font-bold text-[#F0F3F6] mt-0.5">
                  Community
                </h3>
              </div>
              <div className="p-2 rounded bg-[#0B0E11] text-[#3ECF8E] border border-[#262C34]">
                <Terminal className="w-4 h-4" />
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-[var(--font-display)] font-bold text-[#F0F3F6]">
                  $0
                </span>
                <span className="text-xs font-mono text-[#8B949E]">
                  / forever free
                </span>
              </div>
              <p className="text-xs text-[#8B949E] mt-1.5 leading-relaxed">
                Complete local daemon with zero cloud lock-in. Full support for Cursor, Claude Code, and Codex on your machine.
              </p>
            </div>

            <ul className="space-y-3 mb-8 text-xs text-[#F0F3F6]">
              <li className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-[#3ECF8E] shrink-0" />
                <span>Up to 3 concurrent local AI agents</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-[#3ECF8E] shrink-0" />
                <span>P2P zero-collision lock table (localhost:3001)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-[#3ECF8E] shrink-0" />
                <span>Cursor, Claude Code, Codex & Copilot CLI hooks</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-[#3ECF8E] shrink-0" />
                <span>Direct ngrok P2P invite rooms</span>
              </li>
            </ul>
          </div>

          <Link href="/signup?plan=free" className="w-full">
            <DecoButton variant="outline" size="default" className="w-full">
              Start Free ↗
            </DecoButton>
          </Link>
        </div>

        {/* Tier II: Enterprise Pro */}
        <div className="relative bg-[#161B22] border-2 border-[#3ECF8E]/60 rounded-lg p-6 sm:p-7 flex flex-col justify-between shadow-sm">
          <div className="absolute -top-3 right-6 bg-[#3ECF8E] text-black text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded">
            Popular
          </div>

          <div>
            <div className="flex items-center justify-between pb-4 border-b border-[#262C34] mb-6">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#3ECF8E]">
                  Tier 02 // Teams
                </span>
                <h3 className="text-xl font-[var(--font-display)] font-bold text-[#F0F3F6] mt-0.5">
                  Pro Access
                </h3>
              </div>
              <div className="p-2 rounded bg-[#0B0E11] text-[#3ECF8E] border border-[#3ECF8E]/40">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-[var(--font-display)] font-bold text-[#3ECF8E]">
                  $19
                </span>
                <span className="text-xs font-mono text-[#8B949E]">
                  / operator / month
                </span>
              </div>
              <p className="text-xs text-[#8B949E] mt-1.5 leading-relaxed">
                Supabase Postgres lock persistence, unlimited parallel agents, cross-repository dependency graphs, and telemetry dashboard.
              </p>
            </div>

            <ul className="space-y-3 mb-8 text-xs text-[#F0F3F6]">
              <li className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-[#3ECF8E] shrink-0" />
                <span>Unlimited concurrent agent sessions</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-[#3ECF8E] shrink-0" />
                <span>Supabase Realtime cloud state synchronization</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-[#3ECF8E] shrink-0" />
                <span>Cross-agent AST dependency blast radius parser</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-[#3ECF8E] shrink-0" />
                <span>Priority GitHub repository imports & branch syncing</span>
              </li>
            </ul>
          </div>

          <Link href="/signup?plan=pro" className="w-full">
            <DecoButton variant="solid" size="default" className="w-full">
              Get Pro Access ↗
            </DecoButton>
          </Link>
        </div>
      </div>
    </section>
  );
}
