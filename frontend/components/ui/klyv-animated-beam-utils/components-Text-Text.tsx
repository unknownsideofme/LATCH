"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TextProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: "micro" | "sm" | "base" | "lg";
  tone?: "faint" | "muted" | "default" | "accent";
}

export function Text({ size = "base", tone = "default", className, children, ...props }: TextProps) {
  const sizeClasses = {
    micro: "text-[11px] font-mono uppercase tracking-wider",
    sm: "text-xs",
    base: "text-sm",
    lg: "text-base font-semibold",
  }[size];

  const toneClasses = {
    faint: "text-[#8B949E]",
    muted: "text-[#8B949E]",
    default: "text-[#F0F3F6]",
    accent: "text-[#3ECF8E]",
  }[tone];

  return (
    <span className={cn(sizeClasses, toneClasses, className)} {...props}>
      {children}
    </span>
  );
}
