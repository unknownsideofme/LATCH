"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "floating" | "inset" | "default";
}

export const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-center transition-all duration-200",
          variant === "floating" && "bg-[#161B22] shadow-sm border border-[#262C34]",
          variant === "inset" && "bg-[#0B0E11] border border-[#262C34]",
          variant === "default" && "bg-[#12161C] border border-[#262C34]",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Surface.displayName = "Surface";
