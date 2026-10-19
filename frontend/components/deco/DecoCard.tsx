import React from "react";

interface DecoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  stepped?: boolean;
  glowOnHover?: boolean;
  invertOnHover?: boolean;
}

export function DecoCard({
  children,
  className = "",
  ...props
}: DecoCardProps) {
  return (
    <div
      className={`relative bg-card border border-border rounded-[var(--radius)] text-card-foreground transition-all duration-200 hover:border-ring group shadow-sm ${className}`}
      {...props}
    >
      <div className="relative z-10 p-5 sm:p-6">
        {children}
      </div>
    </div>
  );
}
