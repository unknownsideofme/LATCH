"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DecoButton } from "@/components/deco/DecoButton";
import { DecoInput } from "@/components/deco/DecoInput";
import { Sparkles, Terminal } from "lucide-react";
import { GithubIcon } from "@/components/icons/GithubIcon";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") === "pro" ? "pro" : "free";

  const supabase = createClient();
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
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/callback?next=/dashboard`,
          scopes: "read:user repo",
        },
      });
      if (error) throw error;
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
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            preferred_plan: selectedPlan,
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        if (typeof window !== "undefined") {
          localStorage.setItem("latch_user_session", JSON.stringify(authData.user));
        }
        await supabase.from("users").upsert({
          id: authData.user.id,
          email: authData.user.email,
          name: name,
          username: email.split("@")[0],
          project_limit: selectedPlan === "pro" ? 50 : 3,
        });

        router.push("/dashboard");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Sign up failed");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#0B0E11] text-[#F0F3F6]">
      {/* Brand Header */}
      <Link href="/" className="mb-6 flex items-center gap-2.5 group">
        <div className="w-8 h-8 rounded-md bg-[#3ECF8E] text-black font-[var(--font-display)] font-bold text-base flex items-center justify-center">
          L
        </div>
        <span className="font-[var(--font-display)] text-xl font-bold text-[#F0F3F6]">
          Latch
        </span>
      </Link>

      <div className="w-full max-w-md bg-[#12161C] border border-[#262C34] rounded-lg p-6 sm:p-8 shadow-sm">
        <div className="pb-5 border-b border-[#262C34] mb-5 text-center">
          <h1 className="text-xl sm:text-2xl font-[var(--font-display)] text-[#F0F3F6] font-bold tracking-tight">
            Create your account
          </h1>
          <p className="text-xs text-[#8B949E] mt-1.5 font-[var(--font-body)]">
            Configure your coordination node and link your repositories.
          </p>
        </div>

        {/* Plan Selector Buttons */}
        <div className="grid grid-cols-2 gap-1.5 mb-5 p-1 rounded-md bg-[#0B0E11] border border-[#262C34]">
          <button
            type="button"
            onClick={() => setSelectedPlan("free")}
            className={`h-9 text-xs font-medium rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              selectedPlan === "free"
                ? "bg-[#161B22] text-[#F0F3F6] border border-[#262C34] shadow-sm font-semibold"
                : "text-[#8B949E] hover:text-[#F0F3F6]"
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-[#3ECF8E]" />
            Community ($0)
          </button>
          <button
            type="button"
            onClick={() => setSelectedPlan("pro")}
            className={`h-9 text-xs font-medium rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              selectedPlan === "pro"
                ? "bg-[#3ECF8E] text-black font-semibold shadow-sm"
                : "text-[#8B949E] hover:text-[#F0F3F6]"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Pro Tier ($19)
          </button>
        </div>

        {errorMsg && (
          <div className="mb-5 p-3 rounded bg-[#DA7756]/10 border border-[#DA7756]/40 text-[#DA7756] text-xs font-mono">
            {errorMsg}
          </div>
        )}

        <div className="space-y-4">
          <button
            type="button"
            onClick={handleGitHubSignup}
            disabled={loading}
            className="w-full h-11 rounded-md bg-[#3ECF8E] text-black font-[var(--font-display)] font-semibold text-xs sm:text-sm flex items-center justify-center gap-2.5 cursor-pointer hover:bg-[#4EFAAE] active:scale-[0.99] transition-all"
          >
            <GithubIcon className="w-4 h-4 text-black" />
            <span>Sign up with GitHub (Recommended)</span>
          </button>

          <div className="flex items-center gap-3 my-5">
            <div className="h-[1px] flex-1 bg-[#262C34]" />
            <span className="text-[11px] font-mono text-[#8B949E] uppercase">
              or email
            </span>
            <div className="h-[1px] flex-1 bg-[#262C34]" />
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
              className="w-full mt-2"
            >
              {loading ? "Registering…" : `Confirm ${selectedPlan === "pro" ? "Pro" : "Free"} Account`}
            </DecoButton>
          </form>
        </div>

        <div className="mt-6 pt-5 border-t border-[#262C34] flex items-center justify-between text-xs text-[#8B949E]">
          <span>Already registered?</span>
          <Link
            href="/login"
            className="text-[#3ECF8E] font-medium hover:underline text-xs"
          >
            Sign in ↗
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
        <div className="min-h-screen flex items-center justify-center bg-[#0B0E11]">
          <div className="w-7 h-7 rounded-full border-2 border-[#3ECF8E] border-t-transparent animate-spin" />
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
