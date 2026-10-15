import * as React from "react";
import { cn } from "@/lib/utils";
import styles from "./badge.module.css";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "copper" | "success";
}

const variantClassMap: Record<string, string> = {
  default: styles.variantDefault,
  copper: styles.variantCopper,
  secondary: styles.variantSecondary,
  destructive: styles.variantDestructive,
  outline: styles.variantOutline,
  success: styles.variantSuccess,
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(styles.badge, variantClassMap[variant] || styles.variantDefault, className)}
      {...props}
    />
  );
}
