"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DecoButton } from "@/components/deco/DecoButton";
import { DecoInput } from "@/components/deco/DecoInput";
import { GithubIcon } from "@/components/icons/GithubIcon";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleGitHubLogin = async () => {
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

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      if (data?.user && typeof window !== "undefined") {
        localStorage.setItem("latch_user_session", JSON.stringify(data.user));
      }
      router.push("/dashboard");
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid credentials");
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
        <div className="pb-5 border-b border-[#262C34] mb-6 text-center">
          <h1 className="text-xl sm:text-2xl font-[var(--font-display)] text-[#F0F3F6] font-bold tracking-tight">
            Sign in to Latch
          </h1>
          <p className="text-xs text-[#8B949E] mt-1.5 font-[var(--font-body)]">
            Connect your credentials or authorize with GitHub to coordinate machines.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-5 p-3 rounded bg-[#DA7756]/10 border border-[#DA7756]/40 text-[#DA7756] text-xs font-mono">
            {errorMsg}
          </div>
        )}

        {/* Primary Recommended Method: GitHub OAuth via Supabase */}
        <div className="space-y-4">
          <button
            type="button"
            onClick={handleGitHubLogin}
            disabled={loading}
            className="w-full h-11 rounded-md bg-[#3ECF8E] text-black font-[var(--font-display)] font-semibold text-xs sm:text-sm flex items-center justify-center gap-2.5 cursor-pointer hover:bg-[#4EFAAE] active:scale-[0.99] transition-all"
          >
            <GithubIcon className="w-4 h-4 text-black" />
            <span>Continue with GitHub</span>
          </button>

          <div className="flex items-center gap-3 my-5">
            <div className="h-[1px] flex-1 bg-[#262C34]" />
            <span className="text-[11px] font-mono text-[#8B949E] uppercase">
              or email
            </span>
            <div className="h-[1px] flex-1 bg-[#262C34]" />
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <DecoInput
              label="Operator Email"
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
              {loading ? "Authenticating…" : "Sign In with Email"}
            </DecoButton>
          </form>
        </div>

        <div className="mt-6 pt-5 border-t border-[#262C34] flex items-center justify-between text-xs text-[#8B949E]">
          <span>Need an account?</span>
          <Link
            href="/signup"
            className="text-[#3ECF8E] font-medium hover:underline text-xs"
          >
            Register free ↗
          </Link>
        </div>
      </div>
    </div>
  );
}
