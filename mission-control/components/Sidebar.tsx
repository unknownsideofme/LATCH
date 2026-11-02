"use client";

import { useLatch } from "@/lib/LatchContext";
import type { TabId } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
  IconLock,
  IconFileCode,
  IconUsers,
  IconBrain,
  IconTable,
} from "@/components/ui/icons";
import { Bot, Network, Layers, Settings as IconSettings } from "lucide-react";
import ui from "@/styles/ui.module.css";

// Brand icon + ring accent (used across Identity and dropdowns)
const AGENTS: { match: string[]; src: string; ring: string }[] = [
  { match: ["cursor"], src: "/agents/cursor.png", ring: "agentCursor" },
  { match: ["claude"], src: "/agents/claude.png", ring: "agentClaude" },
  { match: ["codex", "openai"], src: "/agents/codex.png", ring: "agentCodex" },
  { match: ["copilot"], src: "/agents/copilot.png", ring: "agentCopilot" },
  { match: ["antigravity", "gemini"], src: "/agents/antigravity.png", ring: "agentAntigravity" },
];

export function agentBrand(label: string) {
  const l = String(label || "").toLowerCase();
  return AGENTS.find((a) => a.match.some((m) => l.includes(m))) || null;
}

export function Sidebar() {
  const {
    dashboard,
    projects,
    selectedProjectId,
    tab,
    setTab,
    graphView,
    setGraphView,
    notices,
  } = useLatch();

  const project = projects.find((p) => p.id === selectedProjectId) || dashboard?.project;
  const live = dashboard && dashboard.project.id === selectedProjectId ? dashboard : null;
  if (!live && !project) return <aside className={`${ui.sidebar} nowheel`} />;

  const inviteUnread = notices.filter((n) => n.type === "invite" && !n.readAt).length;
  const patchesCount = dashboard?.patches?.length || dashboard?.edits?.length || 0;
  const activeLocks = (dashboard?.locks || []).filter((l) => !l.released).length;

  const handleSidebarWheel = (e: React.WheelEvent) => {
    const panel = document.getElementById("latch-panel-scroll");
    if (panel) {
      panel.scrollBy({ top: e.deltaY, behavior: "auto" });
    }
  };

  return (
    <aside className={`${ui.sidebar} nowheel`} onWheel={handleSidebarWheel}>
      <div className={ui.sideHead}>
        <div className={ui.kicker}>Workspace</div>
        <h2>{project?.name || live?.project.name}</h2>
      </div>

      <div className={ui.sideScroll}>
        {/* 1. VIEWS SECTION */}
        <div className={ui.sectionHead} style={{ marginBottom: 6 }}>
          <span className={ui.kicker}>Views</span>
        </div>

        <nav className={ui.sideNav} aria-label="Views Navigation">
          {/* Swarm Topology */}
          <button
            type="button"
            className={`${ui.sideNavItem} ${tab === "locks" && graphView === "swarm" ? ui.sideNavItemActive : ""}`}
            onClick={() => {
              setTab("locks");
              setGraphView("swarm");
            }}
          >
            <span className={ui.sideNavIcon}>
              <Bot size={16} />
            </span>
            <div className={ui.sideNavBody}>
              <span className={ui.sideNavLabel}>Swarm Topology</span>
              <span className={ui.sideNavKicker}>Agent & lock graph</span>
            </div>
          </button>

          {/* AST Blast-Radius */}
          <button
            type="button"
            className={`${ui.sideNavItem} ${tab === "locks" && graphView === "ast" ? ui.sideNavItemActive : ""}`}
            onClick={() => {
              setTab("locks");
              setGraphView("ast");
            }}
          >
            <span className={ui.sideNavIcon}>
              <Network size={16} />
            </span>
            <div className={ui.sideNavBody}>
              <span className={ui.sideNavLabel}>AST Blast-Radius</span>
              <span className={ui.sideNavKicker}>Dependency tree</span>
            </div>
          </button>

          {/* Classic Board */}
          <button
            type="button"
            className={`${ui.sideNavItem} ${tab === "locks" && graphView === "board" ? ui.sideNavItemActive : ""}`}
            onClick={() => {
              setTab("locks");
              setGraphView("board");
            }}
          >
            <span className={ui.sideNavIcon}>
              <Layers size={16} />
            </span>
            <div className={ui.sideNavBody}>
              <span className={ui.sideNavLabel}>Classic Board</span>
              <span className={ui.sideNavKicker}>Visual lock canvas</span>
            </div>
          </button>

          {/* Lock Table */}
          <button
            type="button"
            className={`${ui.sideNavItem} ${tab === "locktable" ? ui.sideNavItemActive : ""}`}
            onClick={() => {
              setTab("locktable");
            }}
          >
            <span className={ui.sideNavIcon}>
              <IconTable size={16} />
            </span>
            <div className={ui.sideNavBody}>
              <span className={ui.sideNavLabel}>Lock Table</span>
              <span className={ui.sideNavKicker}>RAM registry & tokens</span>
            </div>
            {activeLocks > 0 && (
              <Badge
                variant={tab === "locktable" ? "default" : "secondary"}
                className="text-[10px] px-1.5 py-0 h-4 font-bold font-[var(--mono)]"
              >
                {activeLocks}
              </Badge>
            )}
          </button>
        </nav>

        {/* 2. CHAMBERS SECTION */}
        <div className={ui.sectionHead} style={{ marginTop: 16, marginBottom: 6 }}>
          <span className={ui.kicker}>Chambers</span>
        </div>

        <nav className={ui.sideNav} aria-label="Chambers Navigation">
          {/* File Mutex Leases */}
          <button
            type="button"
            className={`${ui.sideNavItem} ${tab === "locks" && graphView === "list" ? ui.sideNavItemActive : ""}`}
            onClick={() => {
              setTab("locks");
              setGraphView("list");
            }}
          >
            <span className={ui.sideNavIcon}>
              <IconLock size={16} />
            </span>
            <div className={ui.sideNavBody}>
              <span className={ui.sideNavLabel}>File Mutex Leases</span>
              <span className={ui.sideNavKicker}>Matrix table</span>
            </div>
            {activeLocks > 0 && (
              <Badge
                variant={tab === "locks" && graphView === "list" ? "default" : "secondary"}
                className="text-[10px] px-1.5 py-0 h-4 font-bold font-[var(--mono)]"
              >
                {activeLocks}
              </Badge>
            )}
          </button>

          {/* Code Edits */}
          <button
            type="button"
            className={`${ui.sideNavItem} ${tab === "edits" ? ui.sideNavItemActive : ""}`}
            onClick={() => setTab("edits")}
          >
            <span className={ui.sideNavIcon}>
              <IconFileCode size={16} />
            </span>
            <div className={ui.sideNavBody}>
              <span className={ui.sideNavLabel}>Code Edits</span>
              <span className={ui.sideNavKicker}>Patches & time-travel</span>
            </div>
            {patchesCount > 0 && (
              <Badge
                variant={tab === "edits" ? "default" : "secondary"}
                className="text-[10px] px-1.5 py-0 h-4 font-bold font-[var(--mono)]"
              >
                {patchesCount}
              </Badge>
            )}
          </button>

          {/* Invites & Rooms */}
          <button
            type="button"
            className={`${ui.sideNavItem} ${tab === "team" ? ui.sideNavItemActive : ""}`}
            onClick={() => setTab("team")}
          >
            <span className={ui.sideNavIcon}>
              <IconUsers size={16} />
            </span>
            <div className={ui.sideNavBody}>
              <span className={ui.sideNavLabel}>Invites & Rooms</span>
              <span className={ui.sideNavKicker}>Collaborators & sync</span>
            </div>
            {inviteUnread > 0 && (
              <Badge
                variant={tab === "team" ? "default" : "secondary"}
                className="text-[10px] px-1.5 py-0 h-4 font-bold font-[var(--mono)]"
              >
                {inviteUnread}
              </Badge>
            )}
          </button>

          {/* Memory Digest */}
          <button
            type="button"
            className={`${ui.sideNavItem} ${tab === "memory" ? ui.sideNavItemActive : ""}`}
            onClick={() => setTab("memory")}
          >
            <span className={ui.sideNavIcon}>
              <IconBrain size={16} />
            </span>
            <div className={ui.sideNavBody}>
              <span className={ui.sideNavLabel}>Memory Digest</span>
              <span className={ui.sideNavKicker}>Context snapshot</span>
            </div>
          </button>

          {/* Settings */}
          <button
            type="button"
            className={`${ui.sideNavItem} ${tab === "settings" ? ui.sideNavItemActive : ""}`}
            onClick={() => setTab("settings")}
          >
            <span className={ui.sideNavIcon}>
              <IconSettings size={16} />
            </span>
            <div className={ui.sideNavBody}>
              <span className={ui.sideNavLabel}>Workspace Settings</span>
              <span className={ui.sideNavKicker}>Config & credentials</span>
            </div>
          </button>
        </nav>
      </div>
    </aside>
  );
}
