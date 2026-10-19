import React from "react";

interface DecoInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function DecoInput({ label, error, className = "", id, ...props }: DecoInputProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className="flex flex-col gap-1.5 w-full text-left">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-medium text-[#8B949E]"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          className={`w-full h-10 bg-[#0B0E11] text-[#F0F3F6] px-3.5 border border-[#262C34] focus:border-[#3ECF8E] focus:outline-none focus:ring-1 focus:ring-[#3ECF8E]/25 transition-all placeholder:text-[#484F58] text-sm rounded-md ${className}`}
          {...props}
        />
      </div>
      {error && (
        <span className="text-xs text-[#DA7756] font-medium mt-0.5">
          {error}
        </span>
      )}
    </div>
  );
}
