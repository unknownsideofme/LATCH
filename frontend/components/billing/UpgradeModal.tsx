"use client";

import { useState } from "react";
import { X, Sparkles, Check, Users, ShieldCheck } from "lucide-react";
import { PayPalSubscriptionButton } from "./PayPalSubscriptionButton";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  onUpgradeSuccess?: () => void;
}

export function UpgradeModal({
  isOpen,
  onClose,
  userId,
  onUpgradeSuccess,
}: UpgradeModalProps) {
  const [seats, setSeats] = useState<number>(1);
  const PRICE_PER_SEAT = 24;

  if (!isOpen) return null;

  const handleIncrement = () => setSeats((s) => Math.min(50, s + 1));
  const handleDecrement = () => setSeats((s) => Math.max(1, s - 1));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-card border border-primary/40 rounded-xl p-6 sm:p-7 shadow-2xl space-y-6 text-foreground">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30 text-[10px] font-mono uppercase tracking-wider mb-2">
            <Sparkles className="w-3 h-3" />
            <span>Scale Your Engineering Swarm</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-[var(--font-display)] font-bold text-foreground tracking-tight">
            Upgrade to LATCH Pro
          </h2>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Eliminate file collision bottlenecks across Cursor, Claude Code, and Codex with persistent cloud locks and telemetry.
          </p>
        </div>

        {/* Seat Selector Stepper */}
        <div className="p-4 rounded-lg bg-muted/40 border border-border flex items-center justify-between">
          <div>
            <span className="text-xs font-mono text-muted-foreground block">Concurrent Team Seats</span>
            <span className="text-xs text-foreground font-semibold flex items-center gap-1 mt-0.5">
              <Users className="w-3.5 h-3.5 text-primary" />
              <span>{seats} Agent {seats === 1 ? "Seat" : "Seats"} Allocated</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDecrement}
              disabled={seats <= 1}
              className="w-8 h-8 rounded border border-border bg-card flex items-center justify-center text-sm font-mono hover:bg-muted disabled:opacity-40 cursor-pointer transition-colors"
            >
              -
            </button>
            <span className="w-6 text-center font-mono font-bold text-sm">{seats}</span>
            <button
              type="button"
              onClick={handleIncrement}
              disabled={seats >= 50}
              className="w-8 h-8 rounded border border-border bg-card flex items-center justify-center text-sm font-mono hover:bg-muted disabled:opacity-40 cursor-pointer transition-colors"
            >
              +
            </button>
          </div>
        </div>

        {/* Price Breakdown */}
        <div className="flex items-baseline justify-between border-b border-border pb-4">
          <span className="text-xs text-muted-foreground font-mono">Billed monthly via PayPal</span>
          <div className="text-right">
            <span className="text-2xl font-bold font-[var(--font-display)] text-foreground">
              ${seats * PRICE_PER_SEAT}
            </span>
            <span className="text-xs text-muted-foreground font-mono"> / month (${PRICE_PER_SEAT}/seat)</span>
          </div>
        </div>

        {/* Key Features Pill */}
        <ul className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>Up to 50 Cloud Projects</span>
          </li>
          <li className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>Unlimited AI Coding Agents</span>
          </li>
          <li className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>AST Blast Radius Analysis</span>
          </li>
          <li className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>Real-time Mutual Exclusion</span>
          </li>
        </ul>

        {/* PayPal Smart Buttons Component */}
        <div className="pt-2">
          <PayPalSubscriptionButton
            seats={seats}
            userId={userId}
            onSuccess={() => {
              if (onUpgradeSuccess) onUpgradeSuccess();
              setTimeout(() => onClose(), 1500);
            }}
          />
        </div>
      </div>
    </div>
  );
}
