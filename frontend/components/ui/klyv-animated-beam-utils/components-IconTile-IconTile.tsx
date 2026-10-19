"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface IconTileProps {
  icon: React.ComponentType<{ className?: string }>;
  tone?: "muted" | "accent" | "default";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function IconTile({ icon: Icon, tone = "default", size = "sm", className }: IconTileProps) {
  const sizeClasses = {
    sm: "w-5 h-5",
    md: "w-6 h-6",
    lg: "w-7 h-7",
  }[size];

  const toneClasses = {
    muted: "text-[#8B949E]",
    accent: "text-[#3ECF8E]",
    default: "text-[#F0F3F6]",
  }[tone];

  return <Icon className={cn(sizeClasses, toneClasses, className)} />;
}
