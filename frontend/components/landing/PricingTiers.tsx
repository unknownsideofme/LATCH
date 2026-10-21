"use client";

import { useState } from "react";
import Link from "next/link";
import { DecoButton } from "@/components/deco/DecoButton";
import { Check, Sparkles, Terminal, ArrowUpRight } from "lucide-react";
import { UpgradeModal } from "@/components/billing/UpgradeModal";

export function PricingTiers() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-16">
      {/* Header */}
      <div className="text-center max-w-xl mx-auto mb-10">
        <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-primary">
          Access Tiers
        </span>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-[var(--font-display)] font-bold text-foreground mt-1 tracking-tight">
          Start for Free. Scale with Your Swarm.
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-muted-foreground font-[var(--font-body)]">
          Free and open-source for solo engineers. Cloud state persistence and telemetry for engineering teams.
        </p>
      </div>

      {/* Grid of Two Tiers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Tier I: Free Community */}
        <div className="relative bg-card border border-border rounded-lg p-6 sm:p-7 flex flex-col justify-between hover:border-ring transition-colors shadow-sm">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-border mb-6">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Tier 01 // Solo
                </span>
                <h3 className="text-xl font-[var(--font-display)] font-bold text-foreground mt-0.5">
                  Community
                </h3>
              </div>
              <div className="p-2 rounded bg-muted text-primary border border-border">
                <Terminal className="w-4 h-4" />
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-[var(--font-display)] font-bold text-foreground">
                  $0
                </span>
                <span className="text-xs font-mono text-muted-foreground">
                  / forever free
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Complete local daemon with zero cloud lock-in. Full support for Cursor, Claude Code, and Codex on your machine.
              </p>
            </div>

            <ul className="space-y-3 mb-8 text-xs text-foreground">
              <li className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Up to 3 concurrent local AI agents</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Sub-millisecond AST file mutex locks</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Basic local Stop Hooks integration</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Community GitHub discussions</span>
              </li>
            </ul>
          </div>

          <Link href="/signup?plan=free" className="w-full">
            <DecoButton variant="outline" size="default" className="w-full">
              <span className="inline-flex items-center gap-1">
                <span>Get Started Free</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </DecoButton>
          </Link>
        </div>

        {/* Tier II: Pro Team */}
        <div className="relative bg-card border-2 border-primary/50 rounded-lg p-6 sm:p-7 flex flex-col justify-between shadow-sm">
          {/* Most Popular Badge */}
          <div className="absolute -top-3 right-6 px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-mono font-bold tracking-wider uppercase shadow-sm">
            Recommended for Swarms
          </div>

          <div>
            <div className="flex items-center justify-between pb-4 border-b border-border mb-6">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-primary">
                  Tier 02 // Engineering Teams
                </span>
                <h3 className="text-xl font-[var(--font-display)] font-bold text-foreground mt-0.5">
                  Pro Swarm
                </h3>
              </div>
              <div className="p-2 rounded bg-muted text-primary border border-primary/40">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-[var(--font-display)] font-bold text-foreground">
                  $24
                </span>
                <span className="text-xs font-mono text-muted-foreground">
                  / seat · month
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Persistent cloud state arbitration for high-throughput AI engineering swarms with live telemetry dashboards.
              </p>
            </div>

            <ul className="space-y-3 mb-8 text-xs text-foreground">
              <li className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Unlimited concurrent AI coding agents</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Cloud Supabase state persistence & audit logs</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Tree-sitter AST dependency blast radius analysis</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Real-time team telemetry dashboard & lock inspector</span>
              </li>
            </ul>
          </div>

          <div className="w-full space-y-2">
            <DecoButton
              variant="solid"
              size="default"
              className="w-full cursor-pointer"
              onClick={() => setIsModalOpen(true)}
            >
              <span className="inline-flex items-center gap-1">
                <span>Subscribe via PayPal</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </DecoButton>
            <div className="text-center">
              <Link href="/signup?plan=pro" className="text-[11px] text-muted-foreground hover:text-foreground underline">
                Or create an account first
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </section>
  );
}
