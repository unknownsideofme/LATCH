"use client";

import { useRelay } from "@/lib/RelayContext";
import type { TabId } from "@/lib/types";
import { ActivityTimeline } from "./ActivityTimeline";
import { CodeEdits } from "./CodeEdits";
import { LayoutSwitcher } from "./LayoutSwitcher";
import { ConnectedAgentsDropdown } from "./ConnectedAgentsDropdown";
import { FileLocksPanel } from "./FileLocksPanel";
import { TeamPanel } from "./TeamPanel";
import { MemoryPanel } from "./MemoryPanel";
import { SettingsPanel } from "./SettingsPanel";
import ui from "@/styles/ui.module.css";

const TAB_TITLES: Record<TabId, { title: string; subtitle: string }> = {
  activity: { title: "Activity", subtitle: "Live multi-agent and user operations" },
  chat: { title: "Chat Stream", subtitle: "Agent conversation transcript and tool logs" },
  edits: { title: "Code Edits", subtitle: "Lamport causal cuts & slide-out diff viewer" },
  locks: { title: "Ongoing Sessions", subtitle: "Coordinator board, file locks & graph" },
  team: { title: "Invites", subtitle: "Collaborator invites & shared room tunnels" },
  memory: { title: "Memory", subtitle: "Project context digest & memory snapshot" },
  settings: { title: "Settings", subtitle: "Workspace configuration & credentials" },
};

export function ProjectDashboard() {
  const { tab } = useRelay();
  const current = TAB_TITLES[tab] || { title: "Dashboard", subtitle: "" };

  return (
    <div className={ui.workspace}>
      <div className={ui.tabsBar}>
        <div className="flex items-center gap-3">
          <h1 className="text-[15.5px] font-bold tracking-tight text-[var(--text)] font-[var(--font-display)] m-0 leading-none">
            {current.title}
          </h1>
          <span className="text-[12px] text-[var(--muted)] font-[var(--font-warm)] hidden sm:inline">
            · {current.subtitle}
          </span>
        </div>
        <div className={ui.tabsBarEnd}>
          <ConnectedAgentsDropdown />
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
