"use client";

import * as React from "react";
import { Award, Building2, Code2, Coins, Flag, Globe, Rocket, Smartphone, Sparkles, Users } from "lucide-react";
import { OrbitTimeline, type OrbitTimelineYear } from "@/components/ui/orbit-timeline";

const DATA: OrbitTimelineYear[] = [
  { year: 2021, events: [{ date: "Apr", icon: <Rocket className="w-3.5 h-3.5" />, title: "Company founded", description: "Three people, one room and a prototype that barely worked." }] },
  {
    year: 2022,
    events: [
      { date: "Feb", icon: <Users className="w-3.5 h-3.5" />, title: "First 10 clients", description: "Signed without a sales team — all from referrals." },
      { date: "Oct", icon: <Coins className="w-3.5 h-3.5" />, title: "Seed round", description: "$1.2M raised to turn the prototype into a product." },
    ],
  },
  {
    year: 2023,
    events: [
      { date: "Mar", icon: <Code2 className="w-3.5 h-3.5" />, title: "Product v2", description: "Rebuilt from scratch: 4× faster and fully self-serve." },
      { date: "Sep", icon: <Users className="w-3.5 h-3.5" />, title: "Team of 25", description: "Engineering, design and support under one roof." },
    ],
  },
  {
    year: 2024,
    events: [
      { date: "Jan", icon: <Smartphone className="w-3.5 h-3.5" />, title: "Mobile app", description: "iOS and Android launch, 20k installs in the first month." },
      { date: "Jun", icon: <Building2 className="w-3.5 h-3.5" />, title: "New HQ", description: "Moved into a studio built around how the team works." },
      { date: "Nov", icon: <Coins className="w-3.5 h-3.5" />, title: "Series A", description: "$9M led by a top-tier fund." },
    ],
  },
  {
    year: 2025,
    events: [
      { date: "Mar", icon: <Globe className="w-3.5 h-3.5" />, title: "Global launch", description: "Opened offices in Dubai and Singapore. Revenue doubled within the year." },
      { date: "Jul", icon: <Sparkles className="w-3.5 h-3.5" />, title: "AI assistant", description: "Shipped the assistant that now handles 60% of requests." },
      { date: "Nov", icon: <Award className="w-3.5 h-3.5" />, title: "Design award", description: "Recognised for product of the year." },
    ],
  },
  { year: 2026, events: [{ date: "Feb", icon: <Flag className="w-3.5 h-3.5" />, title: "1M users", description: "One million people use the product every month." }] },
];

const BAR_CSS = `
.otd { display: flex; flex-direction: column; width: 100%; height: 100%; min-height: 640px; background: #0b0d12; color: #e8eaf0;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
.otd-stage { flex: 1; min-height: 0; position: relative; }
.otd-bar { flex: none; border-top: 1px solid #1f2330; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 28px; padding: 12px 16px; }
.otd-bar.is-collapsed .otd-col { display: none; }
.otd-head { grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.otd-head b { font-size: 13px; font-weight: 700; }
.otd-head small { margin-left: 8px; color: #6b7187; font: 11px ui-monospace, Menlo, monospace; }
.otd-col { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.otd-col h3 { margin: 0 0 2px; padding-bottom: 6px; border-bottom: 1px solid #1f2330; font: 600 11px ui-monospace, Menlo, monospace; letter-spacing: .12em; text-transform: uppercase; color: #6b7187; }
.otd-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 12px; color: #9aa0b4; }
.otd-row > span:first-child { min-width: 78px; }
.otd-seg { display: flex; gap: 2px; background: #161925; border-radius: 10px; padding: 3px; }
.otd-seg button { appearance: none; border: 0; background: transparent; color: #9aa0b4; font-size: 12px; font-weight: 600; font-family: inherit; padding: 5px 10px; border-radius: 8px; cursor: pointer; }
.otd-seg button[aria-pressed="true"] { background: #2a2f44; color: #fff; }
.otd-btn { appearance: none; border: 1px solid #2a2f44; background: #161925; color: #e8eaf0; font-size: 12px; font-weight: 600; font-family: inherit; padding: 6px 10px; border-radius: 8px; cursor: pointer; }
.otd-bar button:focus-visible { outline: 2px solid #7aa2ff; outline-offset: 1px; }
.otd-row input[type=range] { flex: 1; min-width: 80px; max-width: 180px; accent-color: #7aa2ff; }
.otd-val { font: 12px ui-monospace, Menlo, monospace; color: #6b7187; min-width: 4ch; }
@media (max-width: 900px) { .otd-bar { grid-template-columns: 1fr; gap: 14px; max-height: 60vh; overflow-y: auto; } }
`;

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="otd-row">
      <span>{label}</span>
      <div className="otd-seg" role="group" aria-label={label}>
        {options.map(([v, text]) => (
          <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{text}</button>
        ))}
      </div>
    </div>
  );
}

export default function OrbitTimelineDemo() {
  const [theme, setTheme] = React.useState<"dark" | "light">("dark");
  const [years, setYears] = React.useState<"on" | "off">("on");
  const [speed, setSpeed] = React.useState(1);
  const [direction, setDirection] = React.useState<"same" | "alternate">("same");
  const [replay, setReplay] = React.useState(0);
  const [collapsed, setCollapsed] = React.useState(true);

  return (
    <div className="otd">
      <style>{BAR_CSS}</style>
      <div className="otd-stage">
        <OrbitTimeline
          data={DATA}
          theme={theme}
          showYears={years === "on"}
          speed={speed}
          direction={direction}
          replayKey={replay}
          style={{ position: "absolute", inset: 0, minHeight: 0 }}
        />
      </div>

      <div className={`otd-bar${collapsed ? " is-collapsed" : ""}`}>
        <div className="otd-head">
          <div><b>Orbit Timeline</b><small>demo controls</small></div>
          <button type="button" className="otd-btn" aria-expanded={!collapsed} onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? "Show controls" : "Hide controls"}
          </button>
        </div>
        <section className="otd-col">
          <h3>Preview</h3>
          <Seg label="Theme" value={theme} onChange={setTheme} options={[["dark", "Dark"], ["light", "Light"]]} />
          <div className="otd-row"><span>Intro</span><button type="button" className="otd-btn" onClick={() => setReplay((r) => r + 1)}>Replay growth</button></div>
        </section>
        <section className="otd-col">
          <h3>Appearance</h3>
          <Seg label="Year labels" value={years} onChange={setYears} options={[["on", "On"], ["off", "Off"]]} />
        </section>
        <section className="otd-col">
          <h3>Motion</h3>
          <label className="otd-row">
            <span>Orbit speed</span>
            <input type="range" min={0} max={300} value={Math.round(speed * 100)} onChange={(e) => setSpeed(Number(e.target.value) / 100)} aria-label="Orbit speed" />
            <span className="otd-val">{speed.toFixed(1)}×</span>
          </label>
          <Seg label="Direction" value={direction} onChange={setDirection} options={[["same", "Same"], ["alternate", "Alternate"]]} />
        </section>
      </div>
    </div>
  );
}
