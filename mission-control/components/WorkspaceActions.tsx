"use client";

import { useState } from "react";
import { useRelay } from "@/lib/RelayContext";
import { Button } from "@/components/ui/button";
import ui from "@/styles/ui.module.css";

export function WorkspaceActions({ projectId }: { projectId?: string | null }) {
  const { leaveWorkspace, removeWorkspace } = useRelay();
  const [hint, setHint] = useState("");
  const id = projectId;
  if (!id) return null;

  const run = async (fn: (id: string) => Promise<{ ok: boolean; hint?: string }>) => {
    setHint("");
    const result = await fn(id);
    if (!result.ok) setHint(result.hint || "Could not update workspace.");
  };

  return (
    <div className="flex items-center gap-2 mt-4 flex-wrap">
      <Button variant="outline" size="sm" className="h-8 text-xs font-medium" onClick={() => run(leaveWorkspace)}>
        Leave workspace
      </Button>
      <Button variant="destructive" size="sm" className="h-8 text-xs font-medium" onClick={() => run(removeWorkspace)}>
        Remove from Latch
      </Button>
      {hint ? <p style={{ color: "var(--amber)", width: "100%", margin: "8px 0 0" }}>{hint}</p> : null}
    </div>
  );
}
