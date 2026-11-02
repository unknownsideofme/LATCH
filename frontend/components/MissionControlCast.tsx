"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";
import {
  ExternalLink,
  RefreshCw,
  Maximize2,
  Minimize2,
  Bot,
  Network,
  Radio,
  Loader2,
  Code2,
  Users,
  Table,
} from "lucide-react";
import type { ProjectRecord } from "@/lib/types";

interface MissionControlCastProps {
  tab: "swarm-graph" | "ast-graph" | "locks" | "edits" | "team" | "memory";
  project: ProjectRecord;
  className?: string;
}

export function MissionControlCast({ tab, project, className }: MissionControlCastProps) {
  const { resolvedTheme } = useTheme();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const activeTheme = resolvedTheme === "light" ? "light" : "dark";

  // Resolve target Mission Control origin
  const resolveMissionControlUrl = useCallback(
    (view: string, theme: string) => {
      let base = process.env.NEXT_PUBLIC_MISSION_CONTROL_URL;
      if (!base) {
        if (project.render_url) {
          if (
            project.render_url.includes("localhost:3001") ||
            project.render_url.includes("127.0.0.1:3001")
          ) {
            base = project.render_url.replace(":3001", ":3002");
          } else if ((typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) ? false : project.render_url.includes("onrender.com")) {
            base = project.render_url;
          } else {
            base = "http://localhost:3002";
          }
        } else {
          base = "http://localhost:3002";
        }
      }

      try {
        const url = new URL(base);
        url.searchParams.set("embed", "true");
        if (view === "edits") {
          url.searchParams.set("tab", "edits");
        } else if (view === "team") {
          url.searchParams.set("tab", "team");
        } else if (view === "memory") {
          url.searchParams.set("tab", "memory");
        } else {
          url.searchParams.set("tab", "locks");
          url.searchParams.set("view", view === "ast-graph" ? "ast" : view === "locks" ? "list" : "swarm");
        }
        url.searchParams.set("theme", theme);
        url.searchParams.set("projectId", project.id);
        if (project.project_name) {
          url.searchParams.set("projectName", project.project_name);
          url.searchParams.set("project", project.project_name);
        } else {
          url.searchParams.set("project", project.id);
        }
        return url.toString();
      } catch {
        return `${base}?embed=true&tab=locks&view=${view === "ast-graph" ? "ast" : "swarm"}&theme=${theme}`;
      }
    },
    [project.render_url]
  );

  const castUrl = resolveMissionControlUrl(tab, activeTheme);

  // Standalone pop-out URL (without embed=true so full studio opens)
  const popOutUrl = castUrl.replace("embed=true&", "").replace("embed=true", "");

  // Sync theme changes live to iframe via postMessage
  useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: "LATCH_THEME_CHANGE", theme: activeTheme },
        "*"
      );
    }
  }, [activeTheme]);

  // Sync container size changes & fullscreen toggles live to iframe
  useEffect(() => {
    const notifyResize = () => {
      iframeRef.current?.contentWindow?.postMessage({ type: "LATCH_RESIZE" }, "*");
    };

    const timer1 = setTimeout(notifyResize, 150);
    const timer2 = setTimeout(notifyResize, 450);

    const container = iframeRef.current?.parentElement;
    let ro: ResizeObserver | null = null;
    if (container) {
      ro = new ResizeObserver(() => {
        notifyResize();
      });
      ro.observe(container);
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      if (ro) ro.disconnect();
    };
  }, [fullscreen, reloadKey]);

  const handleReload = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  const isAst = tab === "ast-graph";

  return (
    <div
      className={`space-y-3 transition-all ${
        fullscreen
          ? "fixed inset-0 z-50 p-6 bg-background/95 backdrop-blur-md flex flex-col"
          : className || ""
      }`}
    >
      {/* Casting Studio Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-card border border-border shadow-2xs font-mono text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 text-primary">
            {tab === "ast-graph" ? (
              <Network className="w-3.5 h-3.5 animate-pulse" />
            ) : tab === "edits" ? (
              <Code2 className="w-3.5 h-3.5 text-primary" />
            ) : tab === "team" ? (
              <Users className="w-3.5 h-3.5 text-primary" />
            ) : tab === "locks" ? (
              <Table className="w-3.5 h-3.5 text-primary" />
            ) : (
              <Bot className="w-3.5 h-3.5 text-primary" />
            )}
            <span className="font-bold uppercase text-xs tracking-wider">
              {tab === "ast-graph"
                ? "AST Blast Radius Graph"
                : tab === "edits"
                ? "Live Code Edits & Patches"
                : tab === "team"
                ? "Collaborator Invites & Shared Rooms"
                : tab === "locks"
                ? "File Mutex Registry Table"
                : tab === "memory"
                ? ".latch/ Context Digest"
                : "Swarm Concurrency Topology"}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-muted-foreground text-xs font-mono">
            <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
            <span className="text-foreground font-semibold">Live Cast</span>
            <span className="text-muted-foreground/70">| Sub-ms Mutex Bus</span>
          </div>
        </div>

        {/* Toolbar Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleReload}
            title="Refresh stream"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-card hover:bg-muted border border-border text-foreground hover:border-primary/40 transition-colors cursor-pointer text-xs font-medium"
          >
            <RefreshCw className={`w-3 h-3 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
            <span>Reload</span>
          </button>

          <a
            href={popOutUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open Full Mission Control Studio in New Window"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-card hover:bg-muted border border-border text-foreground hover:border-primary/40 transition-colors text-xs font-medium"
          >
            <ExternalLink className="w-3 h-3 text-muted-foreground" />
            <span>Pop-out Studio</span>
          </a>

          <button
            onClick={() => setFullscreen((f) => !f)}
            title={fullscreen ? "Exit Fullscreen" : "Fullscreen View"}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-card hover:bg-muted border border-border text-foreground hover:border-primary/40 transition-colors cursor-pointer text-xs font-medium"
          >
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Embedded Viewport Frame */}
      <div
        className={`relative w-full rounded-lg border border-border overflow-hidden bg-card shadow-sm ${
          fullscreen ? "flex-1 min-h-[500px]" : "h-[740px]"
        }`}
      >
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-card/80 backdrop-blur-xs text-muted-foreground font-mono text-xs space-y-2">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <span className="tracking-wide text-foreground font-semibold">
              Connecting to Coordinator Stream on Port 3002...
            </span>
            <span className="text-xs text-muted-foreground">
              Direct WebSocket RPC and SSE Synchronization
            </span>
          </div>
        )}

        <iframe
          key={`${castUrl}-${reloadKey}`}
          ref={iframeRef}
          src={castUrl}
          title="Latch Mission Control Cast"
          onLoad={() => setLoading(false)}
          className="w-full h-full border-0 bg-background block overflow-hidden"
          scrolling="no"
          style={{ overflow: "hidden" }}
          allow="clipboard-write; clipboard-read"
        />
      </div>
    </div>
  );
}