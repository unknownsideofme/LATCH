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
          className="text-xs font-medium text-muted-foreground"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          className={`w-full h-10 bg-input text-foreground px-3.5 border border-border focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30 transition-all placeholder:text-muted-foreground/60 text-sm rounded-[var(--radius)] ${className}`}
          {...props}
        />
      </div>
      {error && (
        <span className="text-xs text-destructive font-medium mt-0.5">
          {error}
        </span>
      )}
    </div>
  );
}
