"use client";

import { useEffect } from "react";
import { useLatch } from "@/lib/LatchContext";
import type { TabId } from "@/lib/types";
import { CodeEdits } from "./CodeEdits";
import { LayoutSwitcher } from "./LayoutSwitcher";
import { ConnectedAgentsDropdown } from "./ConnectedAgentsDropdown";
import { FileLocksPanel } from "./FileLocksPanel";
import { LockTablePanel } from "./LockTablePanel";
import { TeamPanel } from "./TeamPanel";
import { MemoryPanel } from "./MemoryPanel";
import { SettingsPanel } from "./SettingsPanel";
import ui from "@/styles/ui.module.css";

const TAB_TITLES: Partial<Record<TabId, { title: string; subtitle: string }>> = {
  chat: { title: "Chat Stream", subtitle: "Agent conversation transcript and tool logs" },
  edits: { title: "Code Edits", subtitle: "Lamport causal cuts & slide-out diff viewer" },
  locks: { title: "Ongoing Sessions", subtitle: "Coordinator board, file locks & graph" },
  locktable: { title: "Lock Table", subtitle: "RAM lock registry, fencing tokens & intent annotations" },
  team: { title: "Invites", subtitle: "Collaborator invites & shared room tunnels" },
  memory: { title: "Memory", subtitle: "Project context digest & memory snapshot" },
  settings: { title: "Settings", subtitle: "Workspace configuration & credentials" },
};

export function ProjectDashboard({ isEmbed }: { isEmbed?: boolean }) {
  const { tab, setTab, graphView } = useLatch();
  const isGraph = tab === "locks" && graphView !== "list";
  const current = TAB_TITLES[tab] || { title: "Dashboard", subtitle: "" };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const qTab = sp.get("tab") as TabId;
      if (qTab && ["chat", "edits", "locks", "locktable", "team", "memory", "settings"].includes(qTab)) {
        setTab(qTab);
      }
    }
  }, [setTab]);

  return (
    <div className={`${ui.workspace} ${isEmbed ? "!h-full !w-full !overflow-hidden flex flex-col" : ""}`}>

      {!isEmbed && (
        <div
          className={`${ui.tabsBar} nowheel`}
          onWheel={(e) => {
            const panel = document.getElementById('latch-panel-scroll');
            if (panel) {
              panel.scrollBy({ top: e.deltaY, behavior: 'auto' });
            }
          }}
        >
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
      )}
      <div className={`${ui.panelWrap} ${isEmbed ? "!h-full !flex-1 !overflow-hidden flex flex-col" : ""}`}>

        <div id="latch-panel-scroll" className={`${ui.panelScroll} ${isEmbed ? "!p-0 !overflow-hidden !h-full flex flex-col" : ""}`}>

          {tab === "edits" && <CodeEdits />}
          {tab === "locks" && <FileLocksPanel isEmbed={isEmbed} />}
          {tab === "locktable" && <LockTablePanel />}
          {tab === "team" && <TeamPanel />}
          {tab === "memory" && <MemoryPanel />}
          {tab === "settings" && <SettingsPanel />}
        </div>
        <div className={ui.panelFade} />
      </div>
    </div>
  );
}
