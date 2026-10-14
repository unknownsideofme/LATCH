"use client";

import { useRelay } from "@/lib/RelayContext";
import type { TabId } from "@/lib/types";
import ui from "@/styles/ui.module.css";

export { agentBrand } from "./ConnectedAgentsDropdown";

const TABS: { id: TabId; label: string; icon: string; kicker: string }[] = [
  { id: "activity", label: "Activity", icon: "⚡", kicker: "Live stream" },
  { id: "edits", label: "Code Edits", icon: "✎", kicker: "Diffs & patches" },
  { id: "locks", label: "Ongoing Sessions", icon: "🔒", kicker: "Coordinator graph" },
  { id: "team", label: "Invites", icon: "👥", kicker: "Collaborators" },
  { id: "memory", label: "Memory", icon: "🧠", kicker: "Knowledge & history" },
];

export function Sidebar() {
  const { dashboard, projects, selectedProjectId, tab, setTab, notices } = useRelay();
  const project = projects.find((p) => p.id === selectedProjectId) || dashboard?.project;
  const live = dashboard && dashboard.project.id === selectedProjectId ? dashboard : null;
  if (!live && !project) return <aside className={ui.sidebar} />;

  const inviteUnread = notices.filter((n) => n.type === "invite" && !n.readAt).length;

  return (
    <aside className={ui.sidebar}>
      <div className={ui.sideHead}>
        <div className={ui.kicker}>Workspace</div>
        <h2>{project?.name || live?.project.name}</h2>
      </div>

      <div className={ui.sideScroll}>
        <div className={ui.sectionHead}>
          <span className={ui.kicker}>Navigation</span>
        </div>

        <nav className={ui.sideNav} aria-label="Workspace views">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                className={`${ui.sideNavItem} ${active ? ui.sideNavItemActive : ""}`}
                onClick={() => setTab(t.id)}
              >
                <span className={ui.sideNavIcon}>{t.icon}</span>
                <div className={ui.sideNavBody}>
                  <span className={ui.sideNavLabel}>{t.label}</span>
                  <span className={ui.sideNavKicker}>{t.kicker}</span>
                </div>
                {t.id === "team" && inviteUnread > 0 ? (
                  <span className={ui.tabBadge}>{inviteUnread}</span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
