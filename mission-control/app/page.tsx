"use client";

import { useLatch } from "@/lib/LatchContext";
import { Shell } from "@/components/Shell";
import { LoginGate } from "@/components/LoginGate";
import ui from "@/styles/ui.module.css";

export default function Page() {
  const { user, loading } = useLatch();
  if (loading) return <div className={ui.empty}>Booting ./latch…</div>;
  if (!user) return <LoginGate />;
  return <Shell />;
}
