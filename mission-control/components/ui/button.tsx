import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "copper";
  size?: "default" | "sm" | "lg" | "icon";
}

const variantStyles: Record<string, string> = {
  default:
    "bg-[var(--accent,#7A3438)] text-white hover:bg-[var(--accent-hover,#652B2E)] shadow-sm active:translate-y-[0.5px]",
  copper:
    "bg-[var(--copper,#C28C62)] text-white hover:bg-[var(--copper-hover,#AB7850)] shadow-sm active:translate-y-[0.5px]",
  destructive:
    "bg-[var(--red,#A83236)] text-white hover:bg-[#8F282C] shadow-sm",
  outline:
    "border border-[var(--border,#DDD3C9)] bg-[var(--card,#FFFCF8)] text-[var(--text,#302925)] hover:bg-[var(--elev,#E8E1D7)] shadow-xs",
  secondary:
    "bg-[var(--elev,#E8E1D7)] text-[var(--text,#302925)] hover:bg-[var(--elev-2,#DFD7CC)] border border-[var(--border-soft,#E6DFD6)]",
  ghost:
    "bg-transparent text-[var(--text,#302925)] hover:bg-[var(--elev,#E8E1D7)]",
  link:
    "bg-transparent text-[var(--accent,#7A3438)] underline-offset-4 hover:underline p-0 h-auto",
};

const sizeStyles: Record<string, string> = {
  default: "h-9 px-4 py-2 text-[13.5px]",
  sm: "h-8 rounded-md px-3 text-[12px]",
  lg: "h-11 rounded-md px-6 text-[15px]",
  icon: "h-8 w-8 p-0 rounded-md",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent,#7A3438)] disabled:pointer-events-none disabled:opacity-50 cursor-pointer font-[var(--font)]",
          variantStyles[variant] || variantStyles.default,
          sizeStyles[size] || sizeStyles.default,
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
