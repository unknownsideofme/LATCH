"use client";

import { useState } from "react";
import { useLatch } from "@/lib/LatchContext";
import {
  Shield,
  Bot,
  UserCheck,
  Zap,
  ArrowRight,
  Terminal,
  Cpu,
  Layers,
  Radio,
} from "lucide-react";

function GithubIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

export function LoginGate() {
  const { users, login } = useLatch();
  const [customLogin, setCustomLogin] = useState("");
  const [loadingUser, setLoadingUser] = useState<string | null>(null);

  const handleLogin = async (loginName: string) => {
    try {
      setLoadingUser(loginName);
      await login(loginName);
    } catch (err) {
      console.error("Login failed:", err);
    } finally {
      setLoadingUser(null);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customLogin.trim()) return;
    handleLogin(customLogin.trim());
  };

  const defaultProfiles = [
    {
      login: "dev",
      name: "Dev Operator",
      role: "System Administrator",
      desc: "Full mutex claim rights & project oversight",
      icon: UserCheck,
    },
    {
      login: "swarm",
      name: "AI Swarm Coordinator",
      role: "Autonomous Mutex Manager",
      desc: "High-frequency concurrency arbitrator",
      icon: Bot,
    },
    {
      login: "architect",
      name: "Lead Architect",
      role: "AST Dependency Inspector",
      desc: "Graph analysis, blast radius, & cycle audits",
      icon: Cpu,
    },
  ];

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#111111] text-[#eeeeee] p-4 sm:p-6 selection:bg-[#ffe0c2] selection:text-[#111111]">
      {/* Background Cybernetic Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[700px] h-[450px] bg-[#ffe0c2]/5 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[20%] right-[10%] w-[500px] h-[350px] bg-emerald-500/5 blur-[140px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#191919] border border-[#2a2a2a] text-xs font-mono text-[#ffe0c2] shadow-xs">
            <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span className="font-semibold tracking-wider uppercase">Mission Control v2.4</span>
            <span className="text-[#b4b4b4]/60">|</span>
            <span className="text-[#b4b4b4]">Local Mutex Bus</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-sans flex items-center justify-center gap-2">
            <span className="text-[#ffe0c2]">./latch</span>
            <span className="text-neutral-500 font-light">/</span>
            <span>Studio</span>
          </h1>

          <p className="text-xs sm:text-sm text-[#b4b4b4] max-w-md mx-auto leading-relaxed">
            Multi-agent concurrency dashboard, real-time distributed file locks, and AST dependency graph.
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-[#191919] border border-[#2a2a2a] rounded-xl p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-6">
          {/* Quick Connect Primary Dev Option */}
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-neutral-400 mb-3 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#ffe0c2]" />
              <span>Instant Local Development Access</span>
            </div>

            <button
              onClick={() => handleLogin("dev")}
              disabled={!!loadingUser}
              className="w-full group flex items-center justify-between p-3.5 rounded-lg bg-gradient-to-r from-[#ffe0c2]/15 to-[#ffe0c2]/5 hover:from-[#ffe0c2]/25 hover:to-[#ffe0c2]/10 border border-[#ffe0c2]/30 hover:border-[#ffe0c2]/50 text-[#ffe0c2] font-semibold text-sm transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-[#ffe0c2]/20 text-[#ffe0c2] group-hover:scale-105 transition-transform">
                  <Shield className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-white font-medium group-hover:text-[#ffe0c2] transition-colors">
                    Enter as Dev Operator
                  </div>
                  <div className="text-[11px] text-[#b4b4b4] font-normal">
                    One-click admin entry &bull; Full local permissions
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 text-xs font-mono text-[#ffe0c2] group-hover:translate-x-1 transition-transform">
                <span>{loadingUser === "dev" ? "Connecting..." : "Launch"}</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </button>
          </div>

          {/* Quick Profiles Switcher */}
          <div className="space-y-3 pt-2">
            <div className="text-xs font-mono uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-neutral-400" />
              <span>Simulate Agent or Teammate</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(users.length > 0
                ? users
                : defaultProfiles
              ).map((p) => {
                const isPreset = defaultProfiles.find((dp) => dp.login === p.login);
                const IconComponent = isPreset?.icon || UserCheck;
                return (
                  <button
                    key={p.login}
                    onClick={() => handleLogin(p.login)}
                    disabled={!!loadingUser}
                    className="flex items-start gap-3 p-3 rounded-lg bg-[#222222] hover:bg-[#2a2a2a] border border-[#2a2a2a] hover:border-[#383838] transition-all text-left cursor-pointer group disabled:opacity-50"
                  >
                    <div className="p-2 rounded-md bg-[#191919] border border-[#333333] text-[#ffe0c2] group-hover:border-[#ffe0c2]/40 transition-colors">
                      <IconComponent className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-[#eeeeee] truncate group-hover:text-[#ffe0c2] transition-colors">
                        {p.name || p.login}
                      </div>
                      <div className="text-[10.5px] text-[#b4b4b4] truncate font-mono">
                        @{p.login}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Identity Input Form */}
          <form onSubmit={handleCustomSubmit} className="space-y-2 pt-2">
            <div className="text-xs font-mono uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-neutral-400" />
              <span>Custom Handle</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customLogin}
                onChange={(e) => setCustomLogin(e.target.value)}
                placeholder="e.g. alice, agent-07, reviewer"
                className="flex-1 bg-[#111111] border border-[#2a2a2a] focus:border-[#ffe0c2] focus:ring-1 focus:ring-[#ffe0c2] rounded-lg px-3 py-2 text-xs font-mono text-[#eeeeee] placeholder:text-neutral-600 outline-none transition-all"
              />
              <button
                type="submit"
                disabled={!customLogin.trim() || !!loadingUser}
                className="px-4 py-2 bg-[#2a2a2a] hover:bg-[#333333] border border-[#383838] hover:border-[#ffe0c2]/40 text-xs font-medium text-white rounded-lg transition-all cursor-pointer disabled:opacity-40"
              >
                Join
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="relative my-4 flex items-center justify-center">
            <div className="border-t border-[#2a2a2a] w-full" />
            <span className="bg-[#191919] px-3 text-[11px] font-mono text-neutral-500 uppercase tracking-widest absolute">
              Production Auth
            </span>
          </div>

          {/* GitHub OAuth Button */}
          <div>
            <a
              href="/api/auth/github"
              className="flex items-center justify-center gap-2.5 w-full py-2.5 px-4 rounded-lg bg-[#222222] hover:bg-[#282828] border border-[#2a2a2a] hover:border-neutral-600 text-xs font-medium text-[#eeeeee] transition-all"
            >
              <GithubIcon className="w-4 h-4 text-white" />
              <span>Continue with GitHub OAuth</span>
            </a>
            <div className="text-[10px] text-center text-neutral-500 font-mono mt-2">
              Requires GITHUB_CLIENT_ID &bull; Uses GitHub CLI token if present
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center font-mono text-[11px] text-neutral-500">
          Powered by Latch Distributed Concurrency Bus &bull; Port 3001 &amp; 3002
        </div>
      </div>
    </div>
  );
}
