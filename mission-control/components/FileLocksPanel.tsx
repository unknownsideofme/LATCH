"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useLatch } from "@/lib/LatchContext";
import { apiUrl } from "@/lib/api";
import type { Dashboard } from "@/lib/types";
import { Bot, Network, Layers, Table, Radio, ShieldAlert, Cpu, Eye, FileCode2 } from "lucide-react";
import ui from "@/styles/ui.module.css";

// React Flow touches `window`, so it must not render on the server.
const LockGraphCanvas = dynamic(() => import("./lockgraph/LockGraphCanvas"), {
  ssr: false,
  loading: () => <div className="p-8 text-center text-xs font-mono text-muted-foreground animate-pulse">Loading board…</div>,
});

const SwarmLockGraph = dynamic(() => import("./graphs/SwarmLockGraph").then((m) => m.SwarmLockGraph), {
  ssr: false,
  loading: () => <div className="p-8 text-center text-xs font-mono text-muted-foreground animate-pulse">Loading swarm graph…</div>,
});

const AstDependencyGraph = dynamic(() => import("./graphs/AstDependencyGraph").then((m) => m.AstDependencyGraph), {
  ssr: false,
  loading: () => <div className="p-8 text-center text-xs font-mono text-muted-foreground animate-pulse">Loading AST dependency tree…</div>,
});

function parseAgent(agentId: string) {
  const [label, machine, session] = String(agentId || "").split(":");
  return { label: label || "agent", machine, session };
}

function ttlLeft(lock: { expiresAt?: number }) {
  const ms = (lock.expiresAt || 0) - Date.now();
  if (ms <= 0) return "expiring";
  return `${Math.ceil(ms / 1000)}s`;
}

function GraphView({ graph }: { graph: NonNullable<Dashboard["graph"]> }) {
  const layout = useMemo(() => {
    if (!graph.nodes?.length) return [];
    const cols = Math.max(1, Math.ceil(Math.sqrt(graph.nodes.length)));
    return graph.nodes.map((n, i) => ({
      ...n,
      x: 48 + (i % cols) * 170,
      y: 40 + Math.floor(i / cols) * 78,
    }));
  }, [graph]);

  const pos = new Map(layout.map((n) => [n.id, n]));
  const w = Math.max(640, ...layout.map((n) => n.x + 120));
  const h = Math.max(220, ...layout.map((n) => n.y + 48));

  return (
    <article className="p-4 rounded-xl bg-card border border-border shadow-xs font-sans">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs uppercase font-mono tracking-wider text-foreground font-semibold flex items-center gap-1.5">
          <Network className="w-3.5 h-3.5 text-primary" />
          <span>Dependency Graph</span>
        </h3>
        <span className="text-[11px] font-mono text-muted-foreground">
          {graph.fileCount ?? 0} files &bull; {graph.edgeCount ?? 0} edges
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Live import graph
        {graph.languages?.length ? ` • ${graph.languages.join(", ")}` : ""}. Soft-locks follow dependents
        {graph.lockDepth != null ? ` at depth ${graph.lockDepth}` : ""}.
      </p>
      {layout.length === 0 ? (
        <p className="text-xs text-muted-foreground font-mono">
          No source files found in this workspace yet.
        </p>
      ) : (
        <div className="w-full overflow-x-auto rounded-lg border border-border bg-background p-2">
          <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={Math.min(420, h)}>
            {graph.edges.map((e, i) => {
              const a = pos.get(e.from);
              const b = pos.get(e.to);
              if (!a || !b) return null;
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={a.locked || b.locked ? "var(--primary)" : "var(--border)"}
                  strokeWidth={a.locked || b.locked ? 1.8 : 1.2}
                />
              );
            })}
            {layout.map((n) => (
              <g key={n.id}>
                <circle cx={n.x} cy={n.y} r={n.locked ? 8 : 5} fill={n.locked ? "var(--primary)" : n.cyclic ? "var(--violet)" : "var(--green)"} />
                <text x={n.x + 12} y={n.y + 4} fill="var(--text)" fontSize="11" fontFamily="var(--mono)">
                  {n.id.split("/").slice(-2).join("/")}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}
      {!!graph.nodes?.length && (
        <div className="mt-3 space-y-1">
          {graph.nodes.filter((n) => n.locked).map((n) => (
            <div key={n.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border text-xs font-mono">
              <code className="text-primary">{n.id}</code>
              <span className="text-[10.5px] px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">LOCKED</span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

type ViewMode = "swarm" | "ast" | "board" | "list";

export function FileLocksPanel() {
  const { dashboard, selectedProjectId } = useLatch();
  const [view, setView] = useState<ViewMode>("swarm");
  const [graph, setGraph] = useState(dashboard?.graph || null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const v = sp.get("view");
    if (v === "swarm" || v === "ast" || v === "board" || v === "list") {
      setView(v);
    } else if (v === "table") {
      setView("list");
    }
  }, []);

  useEffect(() => {
    setGraph(dashboard?.graph || null);
  }, [dashboard?.graph]);

  useEffect(() => {
    const id = selectedProjectId || dashboard?.project.id;
    if (!id) return;
    if (dashboard?.graph?.nodes?.length) return;
    fetch(apiUrl(`/api/projects/${id}/graph`))
      .then((r) => (r.ok ? r.json() : null))
      .then((g) => {
        if (g) setGraph(g);
      })
      .catch(() => undefined);
  }, [selectedProjectId, dashboard?.project.id, dashboard?.graph?.nodes?.length]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const connected = dashboard?.agents.filter((a) => a.status === "connected") || [];
  const projectPath = (dashboard?.project?.path || "").toLowerCase().replace(/\\/g, "/");
  const projectId = dashboard?.project?.id || "";
  const belongsToThisProject = (item: { workspaceId?: string | null }): boolean => {
    if (!item?.workspaceId) return true;
    const ws = item.workspaceId.toLowerCase().replace(/\\/g, "/");
    return Boolean(ws === projectId || ws === projectPath || (projectPath && (ws.startsWith(projectPath + "/") || ws === projectPath)));
  };
  const locks = (dashboard?.locks || []).filter((l) => belongsToThisProject(l));
  const reads = (dashboard?.reads || []).filter((r) => belongsToThisProject(r));

  const sessionMap = new Map<string, { id: string; label: string; sessionId?: string; ownerLogin?: string }>();
  for (const a of connected) {
    const key = `${a.ownerLogin || "local"}::${a.label}`;
    sessionMap.set(key, {
      id: a.id,
      label: a.label,
      sessionId: a.sessionId,
      ownerLogin: a.ownerLogin,
    });
  }
  for (const l of locks) {
    const parsed = parseAgent(l.agentId);
    const atMatch = String(l.agentId || "").match(/@([^:]+)$/);
    const owner = l.holder?.login || (atMatch ? atMatch[1] : parsed.machine);
    const label = l.holder?.label || parsed.label;
    const key = `${owner || "local"}::${label}`;
    if (!sessionMap.has(key)) {
      sessionMap.set(key, {
        id: l.agentId,
        label,
        sessionId: parsed.session,
        ownerLogin: owner,
      });
    }
  }
  const sessions = Array.from(sessionMap.values());
  const collisions = dashboard?.stats?.collisions;
  const saved = collisions?.totalSaved ?? 0;
  const roomScope = collisions?.scope === "room";
  const memberLine =
    roomScope && collisions?.byMember?.length
      ? collisions.byMember
          .filter((m) => m.totalSaved > 0)
          .map((m) => `@${m.ownerLogin} ${m.totalSaved}`)
          .join(" · ")
      : "";

  return (
    <div className="space-y-4">
      {/* Collisions Stat Card */}
      <article className="p-4 rounded-xl bg-card border border-border shadow-xs font-sans">
        <div className="flex items-center justify-between">
          <h3 className="text-xs uppercase tracking-wider font-mono font-semibold text-muted-foreground flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-primary" />
            <span>Collisions Prevented {roomScope ? "(Room Distributed)" : ""}</span>
          </h3>
          <span className="text-[10.5px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Active Mutex Guard</span>
          </span>
        </div>

        <div className="text-2xl font-extrabold tracking-tight font-display my-2 text-foreground flex items-baseline gap-2">
          <span className="text-primary text-3xl font-black">{saved}</span>
          <span className="text-sm font-medium text-muted-foreground">conflicts averted by Latch Engine</span>
        </div>

        {memberLine ? (
          <p className="text-xs text-muted-foreground font-mono mb-2">{memberLine}</p>
        ) : null}

        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground font-mono pt-2 border-t border-border/50">
          <span>Blocked claims: <strong className="text-foreground">{collisions?.claimsBlocked ?? 0}</strong></span>
          <span>Held-back patches: <strong className="text-foreground">{(collisions?.patchesBlocked ?? 0) + (collisions?.patchesSkipped ?? 0)}</strong></span>
          <span>Merge flags: <strong className="text-foreground">{collisions?.mergesFlagged ?? 0}</strong></span>
          {(collisions?.patchesDeferred ?? 0) > 0 ? (
            <span>Deferred: <strong className="text-foreground">{collisions?.patchesDeferred}</strong></span>
          ) : null}
        </div>
      </article>

      {/* View Switcher Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border shadow-xs">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span className="text-xs font-mono uppercase tracking-wider font-semibold text-foreground">
            Ongoing Sessions
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            ({sessions.length} agents &bull; {locks.length} active locks)
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              view === "swarm"
                ? "bg-primary/15 text-primary border border-primary/30 font-semibold shadow-xs"
                : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border"
            }`}
            onClick={() => setView("swarm")}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Swarm Topology</span>
          </button>

          <button
            className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              view === "ast"
                ? "bg-primary/15 text-primary border border-primary/30 font-semibold shadow-xs"
                : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border"
            }`}
            onClick={() => setView("ast")}
          >
            <Network className="w-3.5 h-3.5" />
            <span>AST Blast-Radius</span>
          </button>

          <button
            className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              view === "board"
                ? "bg-primary/15 text-primary border border-primary/30 font-semibold shadow-xs"
                : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border"
            }`}
            onClick={() => setView("board")}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Classic Board</span>
          </button>

          <button
            className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              view === "list"
                ? "bg-primary/15 text-primary border border-primary/30 font-semibold shadow-xs"
                : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border"
            }`}
            onClick={() => setView("list")}
          >
            <Table className="w-3.5 h-3.5" />
            <span>Matrix Table</span>
          </button>
        </div>
      </div>

      {view === "swarm" && <SwarmLockGraph />}
      {view === "ast" && <AstDependencyGraph />}
      {view === "board" && <LockGraphCanvas />}

      {view === "list" && (
        <div className="space-y-4">
          {/* Active Agent Sessions */}
          <article className="p-4 rounded-xl bg-card border border-border shadow-xs font-sans">
            <h3 className="text-xs uppercase font-mono tracking-wider text-muted-foreground font-semibold mb-3 flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-primary" />
              <span>Active Agent Sessions</span>
            </h3>
            {sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground font-mono">
                No live claims yet. The next file edit from an agent shows up here immediately.
              </p>
            ) : (
              <div className="space-y-2">
                {sessions.map((a) => (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border text-xs font-mono" key={a.id}>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="font-semibold text-foreground">{a.label}</span>
                      {a.sessionId ? (
                        <span className="px-1.5 py-0.5 rounded bg-card border border-border text-[10.5px] text-muted-foreground">
                          {a.sessionId}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-muted-foreground">{a.ownerLogin ? `@${a.ownerLogin}` : "this machine"}</span>
                  </div>
                ))}
              </div>
            )}
          </article>

          {/* Real-Time File Locks */}
          <article className="p-4 rounded-xl bg-card border border-border shadow-xs font-sans">
            <h3 className="text-xs uppercase font-mono tracking-wider text-muted-foreground font-semibold mb-1 flex items-center gap-1.5">
              <FileCode2 className="w-3.5 h-3.5 text-primary" />
              <span>Real-Time File Locks</span>
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Pushed over SSE as hooks claim files. Same agent can keep editing; a different agent is blocked.
            </p>
            {locks.length === 0 ? (
              <p className="text-xs text-muted-foreground font-mono">No active locks.</p>
            ) : (
              <div className="space-y-2">
                {locks.map((lock) => {
                  const parsed = parseAgent(lock.agentId);
                  const file = lock.filePath.includes("::") ? lock.filePath.split("::")[1] : lock.filePath;
                  const dependents = graph?.nodes.find((n) => n.id === file)?.dependents || [];
                  const left = lock.released
                    ? `held ${Math.max(1, Math.round((now - (lock.releasedAt || now)) / 1000))}s ago`
                    : ttlLeft({ expiresAt: lock.expiresAt || now });
                  return (
                    <div
                      className={`flex items-start justify-between p-3 rounded-lg bg-muted/40 border border-border text-xs font-mono ${
                        lock.released ? "opacity-50" : ""
                      }`}
                      key={`${lock.workspaceId || ""}::${lock.filePath}::${lock.agentId}`}
                    >
                      <div className="space-y-1">
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          <code>{file}</code>
                        </div>
                        {lock.annotation ? (
                          <div className="text-primary text-[11px] italic">
                            Intent: &ldquo;{lock.annotation}&rdquo;
                          </div>
                        ) : null}
                        <div className="text-[11px] text-muted-foreground">
                          {lock.holder?.label || parsed.label} &bull; {parsed.session || "session"} &bull; {lock.source || "coordinator"}
                          {lock.escalated ? " &bull; escalated" : ""}
                          {dependents.length ? ` &bull; soft-locks ${dependents.slice(0, 4).join(", ")}` : ""}
                          {` &bull; ${left}`}
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                          lock.released
                            ? "bg-muted text-muted-foreground border-border"
                            : lock.mode === "read"
                            ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }`}
                      >
                        {lock.released ? "DONE" : (lock.mode || "write").toUpperCase()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </article>

          {/* Being Read */}
          <article className="p-4 rounded-xl bg-card border border-border shadow-xs font-sans">
            <h3 className="text-xs uppercase font-mono tracking-wider text-muted-foreground font-semibold mb-1 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-sky-400" />
              <span>Being Read</span>
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Files agents are looking at right now. Reads never take a lock and never block an edit.
            </p>
            {reads.length === 0 ? (
              <p className="text-xs text-muted-foreground font-mono">Nobody is reading anything.</p>
            ) : (
              <div className="space-y-2">
                {reads.map((r) => {
                  const parsed = parseAgent(r.agentId);
                  return (
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border text-xs font-mono" key={`${r.agentId}::${r.filePath}`}>
                      <div className="space-y-0.5">
                        <code className="text-foreground">{r.filePath}</code>
                        <div className="text-[10.5px] text-muted-foreground">
                          {r.holder?.label || parsed.label} &bull; {Math.max(1, Math.round((now - r.at) / 1000))}s ago
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                        READ
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </article>

          {graph ? <GraphView graph={graph} /> : null}
        </div>
      )}
    </div>
  );
}
