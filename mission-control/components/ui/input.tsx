import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-[var(--border,#DDD3C9)] bg-[var(--card,#FFFCF8)] px-3 py-1 text-[13.5px] font-[var(--font)] text-[var(--text,#302925)] shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--muted,#776F67)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent,#7A3438)] focus-visible:border-[var(--accent,#7A3438)] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
