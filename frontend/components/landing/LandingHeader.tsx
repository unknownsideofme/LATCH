"use client";

import Link from "next/link";
import { DecoButton } from "@/components/deco/DecoButton";
import { ThemeToggle } from "@/components/ThemeToggle";

export function LandingHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-background/85 backdrop-blur-md border-b border-border transition-colors duration-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-[var(--radius)] bg-primary text-primary-foreground font-[var(--font-display)] font-bold text-base flex items-center justify-center shadow-sm">
            L
          </div>
          <div className="flex items-center gap-2">
            <span className="font-[var(--font-display)] tracking-tight text-lg font-bold text-foreground">
              Latch
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border hidden sm:inline">
              v2.4
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-muted-foreground">
          <a href="#evolution" className="hover:text-foreground transition-colors">
            Evolution
          </a>
          <a href="#features" className="hover:text-foreground transition-colors">
            Architecture
          </a>
          <a href="#stream" className="hover:text-foreground transition-colors">
            Telemetry
          </a>
          <a href="#pricing" className="hover:text-foreground transition-colors">
            Pricing
          </a>
          <Link href="/dashboard" className="text-primary hover:opacity-80 transition-opacity">
            Cockpit ↗
          </Link>
        </nav>

        {/* Action CTAs & Theme Toggle */}
        <div className="flex items-center gap-2.5">
          <ThemeToggle />
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
