"use client";

import { useState, useEffect, useMemo } from "react";
import { useLatch } from "@/lib/LatchContext";
import type { FileLock } from "@/lib/types";
import { agentBrand } from "./Sidebar";
import {
  IconLock,
  IconCheck,
  IconCopy,
  IconAlertTriangle,
  IconTable,
} from "./ui/icons";
import styles from "./LockTablePanel.module.css";

function parseAgent(agentId: string): { label: string; host: string; session: string } {
  const parts = String(agentId || "").split(":");
  return {
    label: parts[0] || "Agent",
    host: parts[1] || "",
    session: parts.slice(2).join(":") || "",
  };
}

export function LockTablePanel() {
  const { dashboard } = useLatch();
  const [now, setNow] = useState(Date.now());
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "active" | "read" | "released">("all");
  const [viewStyle, setViewStyle] = useState<"table" | "cards">("table");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Smooth live timer so lease countdowns tick live
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const projectPath = (dashboard?.project?.path || "").toLowerCase().replace(/\\/g, "/");
  const projectId = dashboard?.project?.id || "";

  const belongsToThisProject = (wsId?: string | null): boolean => {
    if (!wsId) return true;
    const ws = wsId.toLowerCase().replace(/\\/g, "/");
    return Boolean(
      ws === projectId ||
      ws === projectPath ||
      (projectPath && (ws.startsWith(projectPath + "/") || ws === projectPath))
    );
  };

  const rawLocks: FileLock[] = useMemo(() => {
    return (dashboard?.locks || []).filter((l) => belongsToThisProject(l.workspaceId));
  }, [dashboard?.locks, projectId, projectPath]);

  const rawReads = useMemo(() => {
    return (dashboard?.reads || []).filter((r) => belongsToThisProject(r.workspaceId));
  }, [dashboard?.reads, projectId, projectPath]);

  // Combine write locks and read presence rows
  const allRows = useMemo(() => {
    const list: (FileLock & { isReadPresence?: boolean })[] = [...rawLocks];
    for (const r of rawReads) {
      if (!list.some((l) => l.filePath === r.filePath && l.agentId === r.agentId)) {
        list.push({
          filePath: r.filePath,
          agentId: r.agentId,
          claimedAt: r.at || now,
          ttlMs: r.ttlMs || 30000,
          expiresAt: r.expiresAt || (r.at || now) + (r.ttlMs || 30000),
          mode: "read",
          holder: r.holder,
          isReadPresence: true,
        });
      }
    }
    return list;
  }, [rawLocks, rawReads, now]);

  // Filtering
  const filteredRows = useMemo(() => {
    return allRows.filter((item) => {
      // Status filter
      if (filterMode === "active" && (item.released || item.mode === "read")) return false;
      if (filterMode === "read" && item.mode !== "read") return false;
      if (filterMode === "released" && !item.released) return false;

      // Search query
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const parsed = parseAgent(item.agentId);
      const file = (item.filePath.includes("::") ? item.filePath.split("::")[1] : item.filePath).toLowerCase();
      const label = (item.holder?.label || parsed.label).toLowerCase();
      const annot = (item.annotation || "").toLowerCase();
      const host = (item.holder?.host || parsed.host).toLowerCase();
      const session = parsed.session.toLowerCase();

      return (
        file.includes(q) ||
        label.includes(q) ||
        annot.includes(q) ||
        host.includes(q) ||
        session.includes(q)
      );
    });
  }, [allRows, filterMode, search]);

  const activeWriteCount = rawLocks.filter((l) => !l.released && l.mode !== "read").length;
  const readCount = rawReads.length;
  const collisions = dashboard?.stats?.collisions;

  const copyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className={styles.container}>
      {/* Top 4 Stat Overview Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span>Active Write Locks</span>
            <span className={styles.statPulse} />
          </div>
          <div className={styles.statValue}>{activeWriteCount}</div>
          <div className={styles.statSubtext}>Exclusive leases held in host RAM</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span>Read Presence</span>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--blue)" }} />
          </div>
          <div className={styles.statValue}>{readCount}</div>
          <div className={styles.statSubtext}>Active observing readers</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span>Collisions Prevented</span>
            <IconAlertTriangle size={14} style={{ color: "var(--copper)" }} />
          </div>
          <div className={styles.statValue}>{collisions?.claimsBlocked ?? 0}</div>
          <div className={styles.statSubtext}>Overlapping edits averted</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span>Lock Engine</span>
            <span className={styles.ramTag}>Host RAM</span>
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 750, color: "var(--text)", marginTop: 4 }}>
            In-Memory Coordinator
          </div>
          <div className={styles.statSubtext}>Sub-millisecond (&lt;0.2ms) arbitration</div>
        </div>
      </div>

      {/* Controls & Search Filter Bar */}
      <div className={styles.controlsBar}>
        <div className={styles.filterGroup}>
          <button
            type="button"
            className={`${styles.filterBtn} ${filterMode === "all" ? styles.filterBtnActive : ""}`}
            onClick={() => setFilterMode("all")}
          >
            All ({allRows.length})
          </button>
          <button
            type="button"
            className={`${styles.filterBtn} ${filterMode === "active" ? styles.filterBtnActive : ""}`}
            onClick={() => setFilterMode("active")}
          >
            Active Write ({activeWriteCount})
          </button>
          <button
            type="button"
            className={`${styles.filterBtn} ${filterMode === "read" ? styles.filterBtnActive : ""}`}
            onClick={() => setFilterMode("read")}
          >
            Reading ({readCount})
          </button>
          <button
            type="button"
            className={`${styles.filterBtn} ${filterMode === "released" ? styles.filterBtnActive : ""}`}
            onClick={() => setFilterMode("released")}
          >
            Released
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: "flex-end" }}>
          <div className={styles.searchWrapper}>
            <input
              type="text"
              placeholder="Filter by file, agent, intent note..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.viewToggleGroup}>
            <button
              type="button"
              onClick={() => setViewStyle("table")}
              className={`${styles.viewToggleBtn} ${viewStyle === "table" ? styles.viewToggleBtnActive : ""}`}
              title="Table View"
            >
              <IconTable size={13} /> Table
            </button>
            <button
              type="button"
              onClick={() => setViewStyle("cards")}
              className={`${styles.viewToggleBtn} ${viewStyle === "cards" ? styles.viewToggleBtnActive : ""}`}
              title="Cards Grid View"
            >
              Cards
            </button>
          </div>
        </div>
      </div>

      {/* Main Lock Table / Grid View */}
      {filteredRows.length === 0 ? (
        <div className={styles.emptyCard}>
          <IconLock size={32} className={styles.emptyIcon} />
          <div className={styles.emptyTitle}>
            {search ? "No locks match your filter" : "Lock table is clear"}
          </div>
          <div className={styles.emptyDesc}>
            When an agent claims a file lease or begins an edit, its lock entry and intent annotation stream here live in real-time.
          </div>
        </div>
      ) : viewStyle === "table" ? (
        <div className={styles.tableCard}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Target File</th>
                  <th>Intent / Annotation</th>
                  <th>Holding Agent</th>
                  <th style={{ textAlign: "center" }}>Fence</th>
                  <th>TTL / Remaining</th>
                  <th style={{ textAlign: "right" }}>Age</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const parsed = parseAgent(row.agentId);
                  const brand = agentBrand(row.holder?.label || parsed.label);
                  const file = row.filePath.includes("::") ? row.filePath.split("::")[1] : row.filePath;
                  const rowKey = `${row.workspaceId || ""}::${row.filePath}::${row.agentId}`;
                  const leftMs = Math.max(0, (row.expiresAt || 0) - now);
                  const secondsLeft = Math.ceil(leftMs / 1000);
                  const ttlTotal = row.ttlMs || 15000;
                  const percentLeft = Math.min(100, Math.max(0, (leftMs / ttlTotal) * 100));

                  return (
                    <tr
                      key={rowKey}
                      className={row.released ? styles.tableRowReleased : ""}
                    >
                      {/* Status */}
                      <td className={styles.td}>
                        {row.released ? (
                          <span className={styles.badgeDone}>DONE</span>
                        ) : row.mode === "read" ? (
                          <span className={styles.badgeRead}>READ</span>
                        ) : (
                          <span className={styles.badgeLocked}>
                            <span className={styles.statPulse} />
                            LOCKED
                          </span>
                        )}
                      </td>

                      {/* File Path */}
                      <td className={styles.td}>
                        <div className={styles.filePathCell}>
                          <span className={styles.filePathText} title={file}>
                            {file}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyText(`file-${rowKey}`, file)}
                            className={styles.copyBtn}
                            title="Copy path"
                          >
                            {copiedId === `file-${rowKey}` ? (
                              <IconCheck size={12} style={{ color: "var(--green)" }} />
                            ) : (
                              <IconCopy size={12} />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Intent / Annotation */}
                      <td className={styles.td}>
                        {row.annotation ? (
                          <div className={styles.annotationBox}>
                            <span className={styles.annotationText} title={row.annotation}>
                              &ldquo;{row.annotation}&rdquo;
                            </span>
                            <button
                              type="button"
                              onClick={() => copyText(`annot-${rowKey}`, row.annotation || "")}
                              className={styles.copyBtn}
                              title="Copy intent annotation"
                            >
                              {copiedId === `annot-${rowKey}` ? (
                                <IconCheck size={11} style={{ color: "var(--green)" }} />
                              ) : (
                                <IconCopy size={11} />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: "var(--muted)", fontStyle: "italic", fontSize: 11 }}>—</span>
                        )}
                      </td>

                      {/* Holding Agent */}
                      <td className={styles.td}>
                        <div className={styles.agentInfo}>
                          {brand && (
                            <img
                              src={brand.src}
                              alt=""
                              className={styles.agentLogo}
                            />
                          )}
                          <span className={styles.agentLabel}>
                            {row.holder?.label || parsed.label}
                          </span>
                          {parsed.session && (
                            <span className={styles.agentSession}>
                              {parsed.session}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Fence Token */}
                      <td className={`${styles.td} ${styles.fencingPill}`}>
                        #{row.fencingToken ?? 1}
                      </td>

                      {/* TTL Countdown */}
                      <td className={styles.td}>
                        {row.released ? (
                          <span style={{ color: "var(--muted)", fontSize: 11 }}>Released</span>
                        ) : row.mode === "read" ? (
                          <span style={{ color: "var(--blue)", fontSize: 11, fontWeight: 700 }}>{secondsLeft}s read</span>
                        ) : (
                          <div className={styles.ttlWrap}>
                            <div className={styles.ttlHeader}>
                              <span>{secondsLeft}s left</span>
                            </div>
                            <div className={styles.ttlTrack}>
                              <div
                                className={styles.ttlFill}
                                style={{ width: `${percentLeft}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Age */}
                      <td className={`${styles.td} ${styles.ageCell}`}>
                        {Math.max(0, Math.round((now - row.claimedAt) / 1000))}s ago
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Cards Grid View */
        <div className={styles.cardGrid}>
          {filteredRows.map((row) => {
            const parsed = parseAgent(row.agentId);
            const brand = agentBrand(row.holder?.label || parsed.label);
            const file = row.filePath.includes("::") ? row.filePath.split("::")[1] : row.filePath;
            const rowKey = `${row.workspaceId || ""}::${row.filePath}::${row.agentId}`;
            const leftMs = Math.max(0, (row.expiresAt || 0) - now);
            const secondsLeft = Math.ceil(leftMs / 1000);

            return (
              <div
                key={rowKey}
                className={`${styles.cardItem} ${row.released ? styles.tableRowReleased : ""}`}
              >
                <div>
                  <div className={styles.cardItemHeader}>
                    <div className={styles.agentInfo}>
                      {brand && <img src={brand.src} alt="" className={styles.agentLogo} />}
                      <span className={styles.agentLabel}>
                        {row.holder?.label || parsed.label}
                      </span>
                      {parsed.session && (
                        <span className={styles.agentSession}>
                          {parsed.session}
                        </span>
                      )}
                    </div>

                    {row.released ? (
                      <span className={styles.badgeDone}>DONE</span>
                    ) : row.mode === "read" ? (
                      <span className={styles.badgeRead}>READ</span>
                    ) : (
                      <span className={styles.badgeLocked}>
                        <span className={styles.statPulse} />
                        {secondsLeft}s
                      </span>
                    )}
                  </div>

                  <div className={styles.cardFilePath} style={{ marginTop: 10, marginBottom: 8 }} title={file}>
                    {file}
                  </div>

                  {row.annotation && (
                    <div className={styles.cardAnnotation}>
                      Intent: &ldquo;{row.annotation}&rdquo;
                    </div>
                  )}
                </div>

                <div className={styles.cardFooter}>
                  <span>Fence #{row.fencingToken ?? 1}</span>
                  <span>{Math.max(0, Math.round((now - row.claimedAt) / 1000))}s ago</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
