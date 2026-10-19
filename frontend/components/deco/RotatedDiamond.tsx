import React from "react";

interface RotatedDiamondProps {
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
  glow?: boolean;
}

export function RotatedDiamond({
  children,
  size = "md",
  className = "",
}: RotatedDiamondProps) {
  const sizeMap = {
    sm: "w-8 h-8 text-xs",
    md: "w-12 h-12 text-sm",
    lg: "w-16 h-16 text-base",
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center ${sizeMap[size]} border-2 border-[#3F3F46] bg-[#18181B] text-[#3ECF8E] font-[var(--font-display)] font-bold rounded-none group-hover:bg-black group-hover:text-[#3ECF8E] group-hover:border-black transition-colors ${className}`}
    >
      {children}
    </div>
  );
}
