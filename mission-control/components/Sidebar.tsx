"use client";

import { useRelay } from "@/lib/RelayContext";
import type { TabId } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
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

import { IconLock, IconFileCode, IconUsers, IconBrain } from "@/components/ui/icons";

const NAV_TABS: { id: TabId; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; kicker: string }[] = [
  { id: "locks", label: "Ongoing Sessions", icon: IconLock, kicker: "Board & locks" },
  { id: "edits", label: "Code Edits", icon: IconFileCode, kicker: "Patches & time-travel" },
  { id: "team", label: "Invites", icon: IconUsers, kicker: "Collaborators" },
  { id: "memory", label: "Memory", icon: IconBrain, kicker: "Context digest" },
];

export function Sidebar() {
  const { dashboard, projects, selectedProjectId, tab, setTab, notices } = useRelay();
  const project = projects.find((p) => p.id === selectedProjectId) || dashboard?.project;
  const live = dashboard && dashboard.project.id === selectedProjectId ? dashboard : null;
  if (!live && !project) return <aside className={ui.sidebar} />;

  const inviteUnread = notices.filter((n) => n.type === "invite" && !n.readAt).length;
  const patchesCount = dashboard?.patches?.length || dashboard?.edits?.length || 0;
  const activeLocks = (dashboard?.locks || []).filter((l) => !l.released).length;

  return (
    <aside className={ui.sidebar}>
      <div className={ui.sideHead}>
        <div className={ui.kicker}>Workspace</div>
        <h2>{project?.name || live?.project.name}</h2>
      </div>

      <div className={ui.sideScroll}>
        <div className={ui.sectionHead} style={{ marginBottom: 6 }}>
          <span className={ui.kicker}>Navigation</span>
        </div>

        <nav className={ui.sideNav} aria-label="Main Navigation">
          {NAV_TABS.map((t) => {
            const isActive = tab === t.id;
            const badgeCount =
              t.id === "team" ? inviteUnread :
              t.id === "edits" ? patchesCount :
              t.id === "locks" ? activeLocks : 0;

            return (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                type="button"
                className={`${ui.sideNavItem} ${isActive ? ui.sideNavItemActive : ""}`}
                onClick={() => setTab(t.id)}
              >
                <span className={ui.sideNavIcon}><t.icon size={16} /></span>
                <div className={ui.sideNavBody}>
                  <span className={ui.sideNavLabel}>{t.label}</span>
                  <span className={ui.sideNavKicker}>{t.kicker}</span>
                </div>
                {badgeCount > 0 && (
                  <Badge
                    variant={isActive ? "default" : "secondary"}
                    className="text-[10px] px-1.5 py-0 h-4 font-bold font-[var(--mono)]"
                  >
                    {badgeCount}
                  </Badge>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

