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
      className={`relative bg-[#12161C] border border-[#262C34] rounded-lg transition-all duration-200 hover:border-[#3ECF8E]/30 group ${className}`}
      {...props}
    >
      <div className="relative z-10 p-5 sm:p-6">
        {children}
      </div>
    </div>
  );
}
