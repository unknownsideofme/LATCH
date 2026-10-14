import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "copper" | "success";
}

const badgeVariants: Record<string, string> = {
  default:
    "border-transparent bg-[var(--accent,#7A3438)] text-white shadow-xs",
  copper:
    "border-transparent bg-[var(--copper,#C28C62)] text-white shadow-xs",
  secondary:
    "border-transparent bg-[var(--elev,#E8E1D7)] text-[var(--text,#302925)]",
  destructive:
    "border-transparent bg-[var(--red,#A83236)] text-white shadow-xs",
  outline:
    "border-[var(--border,#DDD3C9)] text-[var(--text,#302925)] bg-[var(--card,#FFFCF8)]",
  success:
    "border-transparent bg-[var(--green-dim,#E8F4EC)] text-[var(--green,#2B7A4B)] font-bold",
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] font-[var(--font)]",
        badgeVariants[variant] || badgeVariants.default,
        className
      )}
      {...props}
    />
  );
}
