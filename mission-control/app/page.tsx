"use client";

import { useEffect, useState } from "react";
import { useLatch } from "@/lib/LatchContext";
import { Shell } from "@/components/Shell";
import { LoginGate } from "@/components/LoginGate";
import ui from "@/styles/ui.module.css";

export default function Page() {
  const { user, loading } = useLatch();
  const [isEmbed, setIsEmbed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      setIsEmbed(sp.get("embed") === "true");

      // Handle theme sync from URL query param
      const theme = sp.get("theme");
      if (theme) {
        document.documentElement.setAttribute("data-theme", theme);
        document.documentElement.classList.toggle("dark", theme === "dark");
      }

      // Handle live theme change via postMessage
      const handleMessage = (e: MessageEvent) => {
        if (e.data?.type === "LATCH_THEME_CHANGE" && e.data.theme) {
          document.documentElement.setAttribute("data-theme", e.data.theme);
          document.documentElement.classList.toggle("dark", e.data.theme === "dark");
        }
      };
      window.addEventListener("message", handleMessage);
      return () => window.removeEventListener("message", handleMessage);
    }
  }, []);

  if (loading && !isEmbed) return <div className={ui.empty}>Booting ./latch…</div>;
  if (!user && !isEmbed) return <LoginGate />;
  return <Shell isEmbed={isEmbed} />;
}
