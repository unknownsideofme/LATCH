"use client";

import Marquee from "react-fast-marquee";

const stats = [
  { value: "0 ms", label: "Collision Latency", detail: "Zero Overwrites" },
  { value: "100%", label: "AST Parse Rate", detail: "Symbol Graph Mutex" },
  { value: "12+", label: "Concurrent Swarm", detail: "Cursor · Claude · Codex" },
  { value: "10k+", label: "Locks Arbitrated", detail: "Distributed Leases" },
  { value: "P2P", label: "Local Daemon", detail: "Port 3001 Socket" },
];

export function StatsMarquee() {
  return (
    <div className="w-full border-y border-[#262C34] bg-[#12161C] py-2.5 select-none overflow-hidden">
      <Marquee speed={50} gradient={false} autoFill>
        <div className="flex items-center gap-10 pr-10">
          {stats.map((stat, idx) => (
            <div key={idx} className="flex items-baseline gap-2.5">
              <span className="font-[var(--font-display)] font-bold text-lg text-[#3ECF8E]">
                {stat.value}
              </span>
              <span className="text-xs font-medium text-[#F0F3F6]">
                {stat.label}
              </span>
              <span className="text-[11px] font-mono text-[#8B949E]">
                ({stat.detail})
              </span>
              <span className="text-xs text-[#262C34] ml-6 font-mono">
                /
              </span>
            </div>
          ))}
        </div>
      </Marquee>
    </div>
  );
}
