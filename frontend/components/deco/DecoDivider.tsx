import React from "react";

export function DecoDivider({ title }: { title: string }) {
  return (
    <div className="relative my-10 md:my-14 flex items-center justify-center max-w-6xl mx-auto px-4">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-border" />
      </div>
      <div className="relative px-3 bg-background text-[11px] font-mono font-medium tracking-wider text-muted-foreground uppercase">
        {title}
      </div>
    </div>
  );
}
