import * as React from "react";
import { cn } from "@/lib/utils";
import styles from "./button.module.css";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "copper";
  size?: "default" | "sm" | "lg" | "icon";
}

const variantClassMap: Record<string, string> = {
  default: styles.variantDefault,
  outline: styles.variantOutline,
  secondary: styles.variantSecondary,
  ghost: styles.variantGhost,
  destructive: styles.variantDestructive,
  copper: styles.variantCopper,
  link: styles.variantLink,
};

const sizeClassMap: Record<string, string> = {
  default: styles.sizeDefault,
  sm: styles.sizeSm,
  lg: styles.sizeLg,
  icon: styles.sizeIcon,
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          styles.button,
          variantClassMap[variant] || styles.variantDefault,
          sizeClassMap[size] || styles.sizeDefault,
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
