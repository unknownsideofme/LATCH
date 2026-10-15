"use client";

import { useEffect, useRef, useState } from "react";
import { useLatch } from "@/lib/LatchContext";
import type { Agent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconChevronDown, IconChevronUp } from "@/components/ui/icons";
import ui from "@/styles/ui.module.css";

// Brand icon + ring accent
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

function AgentRow({ agent }: { agent: Agent }) {
  const { handshake, user } = useLatch();
  const mine = !agent.ownerLogin || agent.ownerLogin === user?.login;
  const label =
    agent.status === "connected" ? "Connected" : agent.status === "handshaking" ? "Connecting…" : "Connect";
  const brand = agentBrand(agent.label);
  const statusClass =
    agent.status === "connected"
      ? ui.connected
      : agent.status === "handshaking"
        ? ui.handshaking
        : agent.status === "error"
          ? ui.error
          : "";

  return (
    <div className={ui.agentRow}>
      <span className={ui.agentIconWrap}>
        {brand ? (
          <img src={brand.src} alt="" className={`${ui.agentIcon} ${ui[brand.ring]}`} />
        ) : (
          <span className={ui.agentIconFallback}>{agent.label?.[0]?.toUpperCase() || "?"}</span>
        )}
        <span className={`${ui.agentIconDot} ${statusClass}`} />
      </span>
      <div className={ui.agentMeta}>
        <strong>{agent.label}</strong>
        <span>
          {mine ? "your agent" : `@${agent.ownerLogin}`}
          {agent.sessionId && agent.status === "connected" ? ` · ${agent.sessionId}` : ""}
        </span>
      </div>
      {!mine && (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 border border-[var(--border-soft)]">
          theirs
        </Badge>
      )}
      <Button
        variant={agent.status === "connected" ? "default" : "outline"}
        size="sm"
        className="h-7 text-xs px-2.5 font-medium"
        onClick={() => handshake(agent)}
        disabled={agent.status === "handshaking"}
      >
        {label}
      </Button>
    </div>
  );
}

export function ConnectedAgentsDropdown() {
  const { dashboard, selectedProjectId } = useLatch();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const live = dashboard && dashboard.project.id === selectedProjectId ? dashboard : null;
  const agents = live?.agents || [];
  const connectedAgents = agents.filter((a) => a.status === "connected");
  const handshakingAgents = agents.filter((a) => a.status === "handshaking");

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isLive = connectedAgents.length > 0;
  const isBusy = handshakingAgents.length > 0;

  // Deduplicate brand icons for the avatar stack
  const stackSource = connectedAgents.length > 0 ? connectedAgents : agents;
  const seenBrands = new Set<string>();
  const stackBrands: { key: string; src: string; label: string }[] = [];
  for (const a of stackSource) {
    const brand = agentBrand(a.label);
    if (brand && !seenBrands.has(brand.src)) {
      seenBrands.add(brand.src);
      stackBrands.push({ key: `brand-${brand.src}`, src: brand.src, label: a.label });
      if (stackBrands.length >= 4) break;
    }
  }

  return (
    <div className={ui.agentDropdownWrap} ref={ref}>
      <button
        type="button"
        className={`${ui.agentDropdownBtn} ${open ? ui.agentDropdownBtnActive : ""}`}
        onClick={() => setOpen((v) => !v)}
        title="View and connect integrated agents"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span
          className={`${ui.agentDot} ${isLive ? ui.connected : isBusy ? ui.handshaking : ""}`}
        />

        <div className={ui.agentStack}>
          {stackBrands.map((b) => (
            <img
              key={b.key}
              src={b.src}
              alt={b.label}
              className={ui.agentStackImg}
            />
          ))}
        </div>

        <span className={ui.agentDropdownLabel}>
          {connectedAgents.length > 0
            ? `${connectedAgents.length} Agent${connectedAgents.length > 1 ? "s" : ""} Connected`
            : "Integrated Agents"}
        </span>

        <span className={ui.agentDropdownCount}>
          {agents.length}
        </span>

        <span className={ui.agentDropdownChevron} aria-hidden>
          {open ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
        </span>
      </button>

      {open && (
        <div className={ui.agentDropdownMenu}>
          <div className={ui.agentDropdownHeader}>
            <div>
              <div className={ui.agentDropdownTitle}>Integrated Agents</div>
              <div className={ui.agentDropdownSub}>
                {connectedAgents.length} connected · {agents.length} available
              </div>
            </div>
            <span className={`${ui.agentBadge} ${isLive ? ui.agentBadgeLive : ""}`}>
              {isLive ? "Active" : "Idle"}
            </span>
          </div>

          <div className={ui.agentDropdownList}>
            {agents.length === 0 ? (
              <div className={ui.sectionEmpty}>
                No agents registered for this workspace yet.
              </div>
            ) : (
              agents.map((a, idx) => (
                <AgentRow
                  key={`${a.ownerLogin || "local"}:${a.id || a.label}:${a.sessionId || idx}`}
                  agent={a}
                />
              ))
            )}
          </div>

          <div className={ui.agentDropdownFooter}>
            <small>Click Connect to handshake with Cursor, Claude, Codex, Copilot, or Antigravity</small>
          </div>
        </div>
      )}
    </div>
  );
}
