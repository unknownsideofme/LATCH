import React from "react";

interface DecoButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "solid" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export function DecoButton({
  variant = "solid",
  size = "default",
  children,
  icon,
  className = "",
  ...props
}: DecoButtonProps) {
  const sizeClasses = {
    sm: "h-8 px-3 text-xs gap-1.5",
    default: "h-10 px-4 text-xs font-medium gap-2",
    lg: "h-11 px-5 text-sm font-semibold gap-2.5",
  };

  const variantClasses = {
    solid:
      "bg-[#3ECF8E] text-black font-semibold hover:bg-[#4EFAAE] shadow-sm transition-colors duration-150",
    outline:
      "bg-transparent text-[#F0F3F6] font-medium border border-[#262C34] hover:bg-[#161B22] hover:border-[#3E4651] transition-colors duration-150",
    ghost:
      "bg-transparent text-[#8B949E] font-medium hover:text-[#F0F3F6] hover:bg-[#161B22] transition-colors duration-150",
  };

  return (
    <button
      className={`relative inline-flex items-center justify-center font-[var(--font-display)] rounded-md cursor-pointer disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] transition-all ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {icon && <span className="inline-flex items-center shrink-0">{icon}</span>}
      <span className="truncate">{children}</span>
    </button>
  );
}
