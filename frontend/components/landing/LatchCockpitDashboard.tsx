"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  Lock,
  GitBranch,
  Zap,
  Search,
  Bell,
  LayoutDashboard,
  Bot,
  Radio,
  FileCode2,
  Settings,
  ChevronDown,
} from "lucide-react";

export function LatchCockpitDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");

  // KPI Metrics Data using Latch Theme Tokens (warm champagne, coffee, cream)
  const metrics = [
    {
      label: "Active Mutex Leases",
      value: "18",
      delta: "+12% vs last hr",
      subtext: "0 deadlocks · TTL 30s",
      icon: Lock,
      color: "text-primary",
      bgColor: "bg-primary/10",
      borderColor: "border-primary/25",
    },
    {
      label: "Guarded AST Nodes",
      value: "142",
      delta: "+8% bounded",
      subtext: "Tree-sitter TS/Rust/Go",
      icon: GitBranch,
      color: "text-primary",
      bgColor: "bg-secondary/40",
      borderColor: "border-border",
    },
    {
      label: "Clobbers Blocked",
      value: "1,289",
      delta: "100% Zero-Loss",
      subtext: "Atomic write arbitration",
      icon: ShieldCheck,
      color: "text-primary",
      bgColor: "bg-primary/10",
      borderColor: "border-primary/25",
    },
    {
      label: "Sync Latency",
      value: "3.8ms",
      delta: "-14% faster",
      subtext: "Vector clock P2P tunnel",
      icon: Zap,
      color: "text-primary",
      bgColor: "bg-secondary/40",
      borderColor: "border-border",
    },
  ];

  // Swarm Agents Allocation Breakdown (Chart Palette)
  const swarmAgents = [
    { name: "Claude Code", percentage: 40, color: "var(--chart-1, #ffe0c2)", activeFile: "src/auth/session.ts", status: "Claiming lock" },
    { name: "Cursor IDE", percentage: 30, color: "var(--chart-2, #d4a373)", activeFile: "tests/mutex.spec.ts", status: "Patch synced" },
    { name: "Antigravity", percentage: 20, color: "var(--chart-4, #a47551)", activeFile: "src/api/routes.ts", status: "AST guarded" },
    { name: "Codex CLI", percentage: 10, color: "var(--chart-5, #ffe0c1)", activeFile: "lib/engine.ts", status: "Heartbeat OK" },
  ];

  return (
    <div className="w-full bg-card/95 text-card-foreground rounded-2xl border border-border shadow-2xl shadow-black/80 backdrop-blur-xl overflow-hidden font-[var(--font-body)] select-none">
      {/* Cockpit Window Top Bar / Traffic Lights */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/40">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#ff5f56]/80 hover:opacity-100 transition-opacity" />
          <span className="w-3 h-3 rounded-full bg-[#ffbd2e]/80 hover:opacity-100 transition-opacity" />
          <span className="w-3 h-3 rounded-full bg-[#27c93f]/80 hover:opacity-100 transition-opacity" />
          <span className="ml-3 text-xs font-mono text-muted-foreground tracking-wider hidden sm:inline">
            latch://daemon/room-main · port 4040
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-primary/10 text-primary border border-primary/25">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            4 Agents Synchronized
          </span>
          <span className="text-xs text-muted-foreground font-mono hidden md:inline">
            Tunnel: active
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 min-h-[580px]">
        {/* Left Cockpit Sidebar */}
        <aside className="md:col-span-3 lg:col-span-2 border-b md:border-b-0 md:border-r border-border p-4 flex flex-col justify-between bg-muted/20">
          <div className="space-y-6">
            {/* Sidebar Brand / Identity */}
            <div className="flex items-center gap-2.5 px-2">
              <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
                <Lock className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="text-sm font-semibold tracking-tight text-foreground font-[var(--font-display)]">
                  Latch Studio
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">v2.4.0-stable</div>
              </div>
            </div>

            {/* Sidebar Navigation */}
            <nav className="space-y-1">
              {[
                { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
                { id: "locks", label: "Active Locks", icon: Lock, badge: "18" },
                { id: "ast", label: "AST Radius", icon: GitBranch },
                { id: "swarms", label: "Agent Swarms", icon: Bot, badge: "4" },
                { id: "patches", label: "Live Patches", icon: Radio },
                { id: "files", label: "File Workspace", icon: FileCode2 },
              ].map((item) => {
                const IconComponent = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? "bg-primary/15 text-primary shadow-sm border border-primary/30 font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <IconComponent className={`w-4 h-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom Settings Link */}
          <div className="pt-4 border-t border-border">
            <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
              <Settings className="w-4 h-4" />
              <span>Workspace Settings</span>
            </button>
          </div>
        </aside>

        {/* Main Cockpit Content Area */}
        <main className="md:col-span-9 lg:col-span-10 p-5 md:p-6 flex flex-col justify-between space-y-6">
          {/* Top Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
            <div>
              <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground font-[var(--font-display)] flex items-center gap-2">
                <span>Coordination Cockpit</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time multi-agent lock table & AST collision boundary monitor
              </p>
            </div>

            {/* Search and Action Bar */}
            <div className="flex items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  readOnly
                  value=""
                  placeholder="Search files, AST nodes..."
                  className="w-full pl-9 pr-10 py-1.5 bg-muted/50 border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none cursor-default"
                />
                <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono bg-muted text-muted-foreground px-1 rounded border border-border">
                  ⌘K
                </kbd>
              </div>

              <button
                aria-label="Notifications"
                className="relative p-2 rounded-lg bg-muted/50 border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary ring-2 ring-card" />
              </button>
            </div>
          </div>

          {/* 4 Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
            {metrics.map((m, idx) => {
              const Icon = m.icon;
              return (
                <div
                  key={idx}
                  className="rounded-xl bg-card border border-border p-4 transition-all hover:border-primary/40 hover:bg-muted/40 group shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">{m.label}</span>
                    <div className={`p-2 rounded-lg ${m.bgColor} ${m.borderColor} border`}>
                      <Icon className={`w-4 h-4 ${m.color}`} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-bold tracking-tight text-foreground font-mono">{m.value}</span>
                    <span className="text-[11px] font-mono text-primary font-medium">
                      {m.delta}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground font-mono truncate">
                    {m.subtext}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Lower Two Visual Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
            {/* Left Panel: Swarm Throughput & Mutex Activity (Line Chart) */}
            <div className="lg:col-span-7 rounded-xl bg-card border border-border p-5 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div>
                  <h3 className="text-sm font-semibold text-foreground font-[var(--font-display)]">Throughput & Mutex Activity</h3>
                  <p className="text-[11px] text-muted-foreground">Atomic lease arbitrations per second</p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 border border-border px-2.5 py-1 rounded-md hover:text-foreground transition-colors">
                    <span>Last 1 hour</span>
                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* Glowing SVG Spline Area Chart themed with Latch primary champagne / warm tones */}
              <div className="py-4 relative">
                <svg
                  viewBox="0 0 500 180"
                  className="w-full h-44 overflow-visible"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="latchThroughputThemeGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary, #ffe0c2)" stopOpacity="0.30" />
                      <stop offset="60%" stopColor="var(--primary, #ffe0c2)" stopOpacity="0.05" />
                      <stop offset="100%" stopColor="var(--primary, #ffe0c2)" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="latchThemeStroke" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="var(--muted-foreground, #646464)" />
                      <stop offset="35%" stopColor="var(--secondary, #393028)" />
                      <stop offset="70%" stopColor="var(--primary, #ffe0c2)" />
                      <stop offset="100%" stopColor="var(--foreground, #ffffff)" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Guideline Grids */}
                  <line x1="0" y1="40" x2="500" y2="40" stroke="currentColor" className="text-border" strokeDasharray="4 4" />
                  <line x1="0" y1="80" x2="500" y2="80" stroke="currentColor" className="text-border" strokeDasharray="4 4" />
                  <line x1="0" y1="120" x2="500" y2="120" stroke="currentColor" className="text-border" strokeDasharray="4 4" />
                  <line x1="0" y1="160" x2="500" y2="160" stroke="currentColor" className="text-border" />

                  {/* Filled Area */}
                  <path
                    d="M 0 160 Q 50 140, 100 115 T 200 85 T 300 100 T 400 45 T 500 35 L 500 160 L 0 160 Z"
                    fill="url(#latchThroughputThemeGlow)"
                  />

                  {/* High Precision Bezier Curve */}
                  <path
                    d="M 0 160 Q 50 140, 100 115 T 200 85 T 300 100 T 400 45 T 500 35"
                    fill="none"
                    stroke="url(#latchThemeStroke)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />

                  {/* Data Points */}
                  <circle cx="100" cy="115" r="3.5" fill="var(--primary, #ffe0c2)" stroke="var(--card, #191919)" strokeWidth="2" />
                  <circle cx="200" cy="85" r="3.5" fill="var(--primary, #ffe0c2)" stroke="var(--card, #191919)" strokeWidth="2" />
                  <circle cx="300" cy="100" r="3.5" fill="var(--primary, #ffe0c2)" stroke="var(--card, #191919)" strokeWidth="2" />
                  <circle cx="400" cy="45" r="4" fill="var(--foreground, #ffffff)" stroke="var(--card, #191919)" strokeWidth="2" />

                  {/* Pulsing Active Head */}
                  <circle cx="500" cy="35" r="7" fill="var(--primary, #ffe0c2)" opacity="0.3" className="animate-ping" />
                  <circle cx="500" cy="35" r="4" fill="var(--primary, #ffe0c2)" stroke="var(--card, #191919)" strokeWidth="2" />
                </svg>

                {/* X-Axis Time Markers */}
                <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground mt-2 px-1">
                  <span>12:00</span>
                  <span>12:15</span>
                  <span>12:30</span>
                  <span>12:45</span>
                  <span className="text-primary flex items-center gap-1 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Now (84 ops/s)
                  </span>
                </div>
              </div>

              {/* Status Footer */}
              <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  Zero AST conflicts detected across 42 active files
                </span>
                <span className="text-muted-foreground font-mono text-[11px]">TTL: 30s</span>
              </div>
            </div>

            {/* Right Panel: Agent Swarm Donut Allocation */}
            <div className="lg:col-span-5 rounded-xl bg-card border border-border p-5 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div>
                  <h3 className="text-sm font-semibold text-foreground font-[var(--font-display)]">Agent Swarm Allocation</h3>
                  <p className="text-[11px] text-muted-foreground">Parallel agent compute share</p>
                </div>
                <span className="text-[11px] font-mono text-primary bg-primary/10 border border-primary/25 px-2 py-0.5 rounded-full">
                  All 4 Active
                </span>
              </div>

              {/* Donut Chart & Legend Visual */}
              <div className="py-3 flex flex-col sm:flex-row items-center gap-6 justify-center">
                {/* SVG Donut */}
                <div className="relative w-32 h-32 shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    {/* Background Ring */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="currentColor"
                      className="text-muted"
                      strokeWidth="12"
                    />
                    {/* Claude (40%) = 100.48 */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#ffe0c2"
                      strokeWidth="12"
                      strokeDasharray="100.48 251.2"
                      strokeDashoffset="0"
                    />
                    {/* Cursor (30%) = 75.36 */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#d4a373"
                      strokeWidth="12"
                      strokeDasharray="75.36 251.2"
                      strokeDashoffset="-100.48"
                    />
                    {/* Antigravity (20%) = 50.24 */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#8c6239"
                      strokeWidth="12"
                      strokeDasharray="50.24 251.2"
                      strokeDashoffset="-175.84"
                    />
                    {/* Codex (10%) = 25.12 */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#ffe6c4"
                      strokeWidth="12"
                      strokeDasharray="25.12 251.2"
                      strokeDashoffset="-226.08"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-base font-bold font-mono text-foreground">4</span>
                    <span className="text-[10px] text-muted-foreground font-mono uppercase">Agents</span>
                  </div>
                </div>

                {/* Agents List / Breakdown */}
                <div className="flex-1 space-y-2 w-full">
                  {swarmAgents.map((agent, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: agent.color }}
                        />
                        <span className="text-foreground font-medium">{agent.name}</span>
                      </div>
                      <span className="font-mono text-muted-foreground">{agent.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Mutex Lease Active Pill */}
              <div className="mt-2 p-2.5 rounded-lg bg-muted/40 border border-border flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
                  <span className="font-mono text-foreground text-[11px] truncate">
                    src/auth/session.ts
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/25 font-bold">
                    LEASE 18s
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">
                    Claude Code
                  </span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
