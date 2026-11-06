"use client";

import Link from "next/link";
import Image from "next/image";
import { DecoButton } from "@/components/deco/DecoButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { IconArrowUpRight } from "@/components/icons/LatchIcons";

export function LandingHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-background/65 backdrop-blur-md border-b border-border/80 transition-colors duration-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group" title="latch.it">
          <Image
            src="/latch-logo.png"
            alt="latch.it"
            width={120}
            height={28}
            className="h-7 sm:h-8 w-auto object-contain dark:invert group-hover:opacity-85 transition-opacity"
            priority
          />
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border hidden sm:inline">
            v2.4
          </span>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-muted-foreground">
          <a href="#problem-solution" className="hover:text-foreground transition-colors">
            Coordination
          </a>
          <a href="#features" className="hover:text-foreground transition-colors">
            Architecture
          </a>
          <Link href="/dashboard" className="text-primary hover:opacity-80 transition-opacity inline-flex items-center gap-1">
            <span>Cockpit</span>
            <IconArrowUpRight className="w-3.5 h-3.5" />
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
