"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { DecoButton } from "@/components/deco/DecoButton";
import { DecoInput } from "@/components/deco/DecoInput";
import { Sparkles, Terminal, ArrowUpRight } from "lucide-react";
import { GithubIcon } from "@/components/icons/GithubIcon";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ThinkingOrb } from "thinking-orbs";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") === "pro" ? "pro" : "free";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<"free" | "pro">(plan);

  useEffect(() => {
    if (searchParams.get("plan") === "pro") setSelectedPlan("pro");
  }, [searchParams]);

  const handleGitHubSignup = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      window.location.href = `${apiUrl}/api/v1/auth/github`;
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to initialize GitHub OAuth");
      setLoading(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      if (!email.trim() || !password.trim()) {
        throw new Error("Email and password are required");
      }
      const localUser = {
        id: `usr_${Date.now()}`,
        email: email.trim(),
        user_metadata: {
          name: name || email.split("@")[0],
          preferred_plan: selectedPlan,
        },
      };
      if (typeof window !== "undefined") {
        localStorage.setItem("latch_user_session", JSON.stringify(localUser));
      }
      router.push("/dashboard");
    } catch (err: any) {
      setErrorMsg(err.message || "Sign up failed");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background text-foreground relative transition-colors duration-200">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      {/* Brand Header */}
      <Link href="/" className="mb-6 flex items-center gap-2.5 group">
        <div className="w-9 h-9 rounded-md overflow-hidden flex items-center justify-center border border-border bg-card shadow-sm group-hover:border-primary/50 transition-colors p-0.5">
          <Image
            src="/latch-logo.png"
            alt="Latch Logo"
            width={36}
            height={36}
            className="w-full h-full object-contain"
            priority
          />
        </div>
        <span className="font-[var(--font-display)] text-xl font-bold text-foreground">
          Latch
        </span>
      </Link>

      <div className="w-full max-w-md bg-card border border-border rounded-lg p-6 sm:p-8 shadow-sm text-card-foreground">
        <div className="pb-5 border-b border-border mb-5 text-center">
          <h1 className="text-xl sm:text-2xl font-[var(--font-display)] text-foreground font-bold tracking-tight">
            Create your account
          </h1>
          <p className="text-xs text-muted-foreground mt-1.5 font-[var(--font-body)]">
            Configure your coordination node and link your repositories.
          </p>
        </div>

        {/* Plan Selector Buttons */}
        <div className="grid grid-cols-2 gap-1.5 mb-5 p-1 rounded-md bg-muted/50 border border-border">
          <button
            type="button"
            onClick={() => setSelectedPlan("free")}
            className={`h-9 text-xs font-medium rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              selectedPlan === "free"
                ? "bg-card text-foreground border border-border shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-primary" />
            Community ($0)
          </button>
          <button
            type="button"
            onClick={() => setSelectedPlan("pro")}
            className={`h-9 text-xs font-medium rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              selectedPlan === "pro"
                ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Pro Tier ($24)
          </button>
        </div>

        {errorMsg && (
          <div className="mb-5 p-3 rounded bg-destructive/10 border border-destructive/40 text-destructive text-xs font-mono">
            {errorMsg}
          </div>
        )}

        <div className="space-y-4">
          <button
            type="button"
            onClick={handleGitHubSignup}
            disabled={loading}
            className="w-full h-11 rounded-md bg-primary text-primary-foreground font-[var(--font-display)] font-semibold text-xs sm:text-sm flex items-center justify-center gap-2.5 cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all shadow-sm"
          >
            <GithubIcon className="w-4 h-4 text-primary-foreground" />
            <span>Sign up with GitHub (Recommended)</span>
          </button>

          <div className="flex items-center gap-3 my-5">
            <div className="h-[1px] flex-1 bg-border" />
            <span className="text-[11px] font-mono text-muted-foreground uppercase">
              or email
            </span>
            <div className="h-[1px] flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmailSignup} className="space-y-4">
            <DecoInput
              label="Operator Name"
              type="text"
              required
              placeholder="Ada Lovelace"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <DecoInput
              label="Email Address"
              type="email"
              required
              placeholder="operator@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <DecoInput
              label="Password"
              type="password"
              required
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <DecoButton
              type="submit"
              variant="outline"
              size="default"
              disabled={loading}
              className="w-full mt-2 min-h-[40px] flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <ThinkingOrb state="connecting" size={20} />
                  <span>Registering Account…</span>
                </span>
              ) : (
                `Confirm ${selectedPlan === "pro" ? "Pro" : "Free"} Account`
              )}
            </DecoButton>
          </form>
        </div>

        <div className="mt-6 pt-5 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>Already registered?</span>
          <Link
            href="/login"
            className="text-primary font-medium hover:underline text-xs inline-flex items-center gap-1"
          >
            <span>Sign in</span>
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground gap-3">
          <ThinkingOrb state="breathing" size={64} />
          <p className="text-xs font-mono text-muted-foreground">
            Preparing Latch Workspace…
          </p>
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
