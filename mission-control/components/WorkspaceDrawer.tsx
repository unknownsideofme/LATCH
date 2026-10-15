"use client";

import { useEffect, useState } from "react";
import { useLatch } from "@/lib/LatchContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconX, IconMoreVertical, IconPlus } from "@/components/ui/icons";
import ui from "@/styles/ui.module.css";

function inkFor(hex?: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#000000" : "#ffffff";
}

export function WorkspaceDrawer() {
  const {
    projects,
    dashboard,
    selectedProjectId,
    selectProject,
    drawerOpen,
    setDrawerOpen,
    setAddOpen,
    leaveWorkspace,
    removeWorkspace,
  } = useLatch();

  const activeId = selectedProjectId || dashboard?.project.id;
  const [menuId, setMenuId] = useState<string | null>(null);

  const uniqueProjects = Array.from(new Map(projects.map((p) => [p.id, p])).values());

  // Close options menu on outside click
  useEffect(() => {
    if (!menuId) return;
    const close = () => setMenuId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuId]);

  // Close drawer on Escape key
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (menuId) {
          setMenuId(null);
        } else {
          setDrawerOpen(false);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, menuId, setDrawerOpen]);

  return (
    <>
      <div
        className={`${ui.drawerBackdrop} ${drawerOpen ? ui.drawerBackdropVisible : ""}`}
        onClick={() => {
          setDrawerOpen(false);
          setMenuId(null);
        }}
        aria-hidden={!drawerOpen}
      />

      <aside
        className={`${ui.drawer} ${drawerOpen ? ui.drawerOpen : ""}`}
        aria-label="Workspaces drawer"
        aria-hidden={!drawerOpen}
      >
        <div className={ui.drawerHead}>
          <div className={ui.drawerTitleWrap}>
            <span className={ui.drawerTitle}>Workspaces</span>
            <span className={ui.drawerCount}>{uniqueProjects.length}</span>
          </div>
          <button
            className={ui.drawerClose}
            onClick={() => {
              setDrawerOpen(false);
              setMenuId(null);
            }}
            title="Close menu (Esc)"
            aria-label="Close menu"
          >
            <IconX size={16} />
          </button>
        </div>

        <div className={ui.drawerList}>
          {uniqueProjects.map((p) => {
            const isActive = activeId === p.id;
            return (
              <div
                key={p.id}
                className={`${ui.drawerItem} ${isActive ? ui.drawerItemActive : ""}`}
                onClick={() => {
                  void selectProject(p.id);
                  setDrawerOpen(false);
                  setMenuId(null);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenuId(p.id);
                }}
              >
                <div
                  className={ui.drawerItemTile}
                  style={{ background: p.color, color: inkFor(p.color) }}
                >
                  {p.initials}
                </div>

                <div className={ui.drawerItemMeta}>
                  <div className={ui.drawerItemName}>{p.name}</div>
                  <div className={ui.drawerItemPath}>{p.path}</div>
                </div>

                {isActive && (
                  <Badge variant="default" className="text-[10px] px-2 py-0 h-5 font-semibold bg-[var(--accent)] text-white">
                    Active
                  </Badge>
                )}

                <button
                  className={ui.drawerItemMoreBtn}
                  title="Workspace options"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuId(menuId === p.id ? null : p.id);
                  }}
                >
                  <IconMoreVertical size={14} />
                </button>
              </div>
            );
          })}
        </div>

        {menuId ? (
          <div
            className={ui.menu}
            style={{ left: 180, top: 120, bottom: "auto", zIndex: 1001 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4>Workspace options</h4>
            <button
              className={ui.row}
              onClick={() => {
                void leaveWorkspace(menuId);
                setMenuId(null);
              }}
            >
              Leave workspace
            </button>
            <button
              className={ui.row}
              onClick={() => {
                void removeWorkspace(menuId);
                setMenuId(null);
              }}
            >
              Remove from Latch
            </button>
            <button className={ui.row} onClick={() => setMenuId(null)}>
              Cancel
            </button>
          </div>
        ) : null}

        <div className={ui.drawerFoot}>
          <Button
            variant="default"
            className="w-full h-9 gap-2 font-semibold text-[13px] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white shadow-xs"
            onClick={() => {
              setDrawerOpen(false);
              setAddOpen(true);
            }}
          >
            <IconPlus size={14} />
            <span>Add workspace</span>
          </Button>
          <div className={ui.drawerEscHint}>Press Esc to close</div>
        </div>
      </aside>
    </>
  );
}

export { WorkspaceDrawer as WorkspaceRail };
