"use client";

import { useState, useEffect } from "react";
import { X, Sparkles, Check, Users, ShieldCheck, Clock, Zap, Rocket, Crown } from "lucide-react";
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
  const seats = 1;
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const PRICE_PER_SEAT = 24;

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPaymentSuccess(false);
      setShowConfetti(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;


  const handlePaymentSuccess = () => {
    setPaymentSuccess(true);
    setShowConfetti(true);
    if (onUpgradeSuccess) onUpgradeSuccess();

    // Auto-dismiss confetti particles after animation
    setTimeout(() => setShowConfetti(false), 4000);
  };

  // ─── SUCCESS CELEBRATION SCREEN ───
  if (paymentSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
        {/* Confetti Particles */}
        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
            {Array.from({ length: 40 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-5%`,
                  backgroundColor: [
                    "#22c55e", "#3b82f6", "#f59e0b", "#ec4899",
                    "#8b5cf6", "#06b6d4", "#f97316", "#10b981",
                  ][i % 8],
                  animation: `confetti-fall ${2 + Math.random() * 2}s ease-in ${Math.random() * 0.8}s forwards`,
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              />
            ))}
          </div>
        )}

        <div className="relative w-full max-w-lg bg-card border border-primary/40 rounded-xl p-8 shadow-2xl text-foreground overflow-hidden">
          {/* Animated glow ring behind the icon */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="w-48 h-48 rounded-full opacity-20"
              style={{
                background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)",
                animation: "pulse-glow 2s ease-in-out infinite",
              }}
            />
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer z-10"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="relative z-10 flex flex-col items-center text-center space-y-5">
            {/* Animated Check Icon */}
            <div
              className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center"
              style={{ animation: "success-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards" }}
            >
              <div style={{ animation: "check-draw 0.3s ease-out 0.3s both" }}>
                <Crown className="w-8 h-8 text-primary" />
              </div>
            </div>

            {/* Success Title */}
            <div
              className="space-y-1.5"
              style={{ animation: "fade-up 0.5s ease-out 0.2s both" }}
            >
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Payment Successful!
              </h2>
              <p className="text-sm text-primary font-semibold font-mono">
                Pro Swarm Pass Activated
              </p>
            </div>

            {/* Unlocked Limits Card */}
            <div
              className="w-full p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3"
              style={{ animation: "fade-up 0.5s ease-out 0.4s both" }}
            >
              <span className="text-[10px] font-mono uppercase tracking-wider text-primary block">
                Limits Unlocked
              </span>

              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col items-center gap-1 p-2.5 rounded-md bg-card border border-border">
                  <Rocket className="w-5 h-5 text-primary" />
                  <span className="text-lg font-bold text-foreground font-mono">10</span>
                  <span className="text-[10px] text-muted-foreground">Projects</span>
                </div>
                <div className="flex flex-col items-center gap-1 p-2.5 rounded-md bg-card border border-border">
                  <Users className="w-5 h-5 text-primary" />
                  <span className="text-lg font-bold text-foreground font-mono">20</span>
                  <span className="text-[10px] text-muted-foreground">Agents / Project</span>
                </div>
                <div className="flex flex-col items-center gap-1 p-2.5 rounded-md bg-card border border-border">
                  <Clock className="w-5 h-5 text-primary" />
                  <span className="text-lg font-bold text-foreground font-mono">30</span>
                  <span className="text-[10px] text-muted-foreground">Days Access</span>
                </div>
              </div>
            </div>

            {/* Feature Badges */}
            <div
              className="flex flex-wrap items-center justify-center gap-2"
              style={{ animation: "fade-up 0.5s ease-out 0.6s both" }}
            >
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-mono border border-primary/20">
                <Check className="w-3 h-3" /> AST Boundary Analysis
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-mono border border-primary/20">
                <ShieldCheck className="w-3 h-3" /> Real-time Mutex
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-mono border border-primary/20">
                <Zap className="w-3 h-3" /> Priority Support
              </span>
            </div>

            {/* CTA Button */}
            <button
              onClick={onClose}
              className="w-full py-3 px-6 rounded-lg bg-primary hover:opacity-90 text-primary-foreground font-semibold text-sm transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2"
              style={{ animation: "fade-up 0.5s ease-out 0.8s both" }}
            >
              <Sparkles className="w-4 h-4" />
              <span>Enter Pro Workspace</span>
            </button>
          </div>
        </div>

        {/* Keyframe Animations */}
        <style jsx global>{`
          @keyframes confetti-fall {
            0% {
              transform: translateY(0) rotate(0deg) scale(1);
              opacity: 1;
            }
            100% {
              transform: translateY(100vh) rotate(720deg) scale(0.3);
              opacity: 0;
            }
          }

          @keyframes pulse-glow {
            0%, 100% {
              transform: scale(1);
              opacity: 0.15;
            }
            50% {
              transform: scale(1.15);
              opacity: 0.25;
            }
          }

          @keyframes success-pop {
            0% {
              transform: scale(0);
              opacity: 0;
            }
            50% {
              transform: scale(1.2);
            }
            100% {
              transform: scale(1);
              opacity: 1;
            }
          }

          @keyframes check-draw {
            0% {
              transform: scale(0) rotate(-45deg);
              opacity: 0;
            }
            100% {
              transform: scale(1) rotate(0deg);
              opacity: 1;
            }
          }

          @keyframes fade-up {
            0% {
              transform: translateY(12px);
              opacity: 0;
            }
            100% {
              transform: translateY(0);
              opacity: 1;
            }
          }
        `}</style>
      </div>
    );
  }

  // ─── NORMAL UPGRADE MODAL ───
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
            <span>30-Day Pro Swarm Pass</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-[var(--font-display)] font-bold text-foreground tracking-tight">
            Unlock LATCH Pro for 30 Days
          </h2>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Provision up to 10 cloud projects, coordinate up to 20 coding agents per workspace, and lock files across multiple IDE windows.
          </p>
        </div>



        {/* Price Breakdown */}
        <div className="flex items-baseline justify-between border-b border-border pb-4">
          <div className="space-y-0.5">
            <span className="text-xs text-foreground font-semibold font-mono block">One-Time Payment</span>
            <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-1">
              <Clock className="w-3 h-3 text-primary" />
              <span>30 days access · No recurring auto-charges</span>
            </span>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold font-[var(--font-display)] text-foreground">
              ${seats * PRICE_PER_SEAT}
            </span>
            <span className="text-xs text-muted-foreground font-mono"> / 30 days</span>
          </div>
        </div>

        {/* Key Features List */}
        <ul className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>Up to 10 Cloud Projects</span>
          </li>
          <li className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>Up to 20 Agents / Project</span>
          </li>
          <li className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>AST Boundary Analysis</span>
          </li>
          <li className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>Real-time Mutual Exclusion</span>
          </li>
        </ul>

        {/* PayPal Smart Payment Button */}
        <div className="pt-2">
          <PayPalSubscriptionButton
            seats={seats}
            userId={userId}
            onSuccess={handlePaymentSuccess}
          />
        </div>
      </div>
    </div>
  );
}
