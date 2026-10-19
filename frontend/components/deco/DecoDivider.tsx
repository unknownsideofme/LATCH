import React from "react";

export function DecoDivider({ title }: { title: string }) {
  return (
    <div className="relative my-10 md:my-14 flex items-center justify-center max-w-6xl mx-auto px-4">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-[#262C34]" />
      </div>
      <div className="relative px-3 bg-[#0B0E11] text-[11px] font-mono font-medium tracking-wider text-[#8B949E] uppercase">
        {title}
      </div>
    </div>
  );
}
