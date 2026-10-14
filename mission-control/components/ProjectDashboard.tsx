"use client";

import { useRelay } from "@/lib/RelayContext";
import { ActivityTimeline } from "./ActivityTimeline";
import { CodeEdits } from "./CodeEdits";
import { LayoutSwitcher } from "./LayoutSwitcher";
import { FileLocksPanel } from "./FileLocksPanel";
import { TeamPanel } from "./TeamPanel";
import { MemoryPanel } from "./MemoryPanel";
import { SettingsPanel } from "./SettingsPanel";
import { ConnectedAgentsDropdown } from "./ConnectedAgentsDropdown";
import ui from "@/styles/ui.module.css";

const TAB_TITLES: Record<string, { label: string; icon: string }> = {
  activity: { label: "Activity", icon: "⚡" },
  edits: { label: "Code Edits", icon: "✎" },
  locks: { label: "Ongoing Sessions", icon: "🔒" },
  team: { label: "Invites", icon: "👥" },
  memory: { label: "Memory", icon: "🧠" },
  settings: { label: "Settings", icon: "⚙" },
};

export function ProjectDashboard() {
  const { tab } = useRelay();
  const current = TAB_TITLES[tab] || { label: tab, icon: "•" };

  return (
    <div className={ui.workspace}>
      <div className={ui.tabsBar}>
        <div className={ui.tabsBarLeft}>
          <div className={ui.activeTabIndicator}>
            <span className={ui.activeTabIcon}>{current.icon}</span>
            <span className={ui.activeTabLabel}>{current.label}</span>
          </div>

          <div className={ui.tabsBarDivider} />

          {/* Connected Agent dropdown in the horizontal bar */}
          <ConnectedAgentsDropdown />
        </div>

        <div className={ui.tabsBarEnd}>
          <LayoutSwitcher />
        </div>
      </div>

      <div className={ui.panelWrap}>
        <div className={ui.panelScroll}>
          {tab === "activity" && <ActivityTimeline />}
          {tab === "edits" && <CodeEdits />}
          {tab === "locks" && <FileLocksPanel />}
          {tab === "team" && <TeamPanel />}
          {tab === "memory" && <MemoryPanel />}
          {tab === "settings" && <SettingsPanel />}
        </div>
        <div className={ui.panelFade} />
      </div>
    </div>
  );
}
