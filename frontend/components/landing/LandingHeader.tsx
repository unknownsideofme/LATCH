"use client";

import Link from "next/link";
import { DecoButton } from "@/components/deco/DecoButton";

export function LandingHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-[#0B0E11]/85 backdrop-blur-md border-b border-[#262C34]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-md bg-[#3ECF8E] text-black font-[var(--font-display)] font-bold text-base flex items-center justify-center">
            L
          </div>
          <div className="flex items-center gap-2">
            <span className="font-[var(--font-display)] tracking-tight text-lg font-bold text-[#F0F3F6]">
              Latch
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#161B22] text-[#3ECF8E] border border-[#262C34] hidden sm:inline">
              v2.4
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-[#8B949E]">
          <a href="#evolution" className="hover:text-[#F0F3F6] transition-colors">
            Evolution
          </a>
          <a href="#features" className="hover:text-[#F0F3F6] transition-colors">
            Architecture
          </a>
          <a href="#stream" className="hover:text-[#F0F3F6] transition-colors">
            Telemetry
          </a>
          <a href="#pricing" className="hover:text-[#F0F3F6] transition-colors">
            Pricing
          </a>
          <Link href="/dashboard" className="text-[#3ECF8E] hover:text-[#4EFAAE] transition-colors">
            Cockpit ↗
          </Link>
        </nav>

        {/* Action CTAs */}
        <div className="flex items-center gap-2.5">
          <Link href="/login">
            <DecoButton variant="ghost" size="sm">
              Sign In
            </DecoButton>
          </Link>
          <Link href="/signup">
            <DecoButton variant="solid" size="sm">
              Start Free
            </DecoButton>
          </Link>
        </div>
      </div>
    </header>
  );
}
