"use client";

import { useRef } from "react";
import { Cloud, CreditCard, Database, Landmark, Shield, Wallet } from "lucide-react";
import { AnimatedBeam } from "@/components/ui/klyv-animated-beam";
import { IconTile } from "@/components/ui/klyv-animated-beam-utils/components-IconTile-IconTile";
import { Surface } from "@/components/ui/klyv-animated-beam-utils/components-Surface-Surface";
import { Text } from "@/components/ui/klyv-animated-beam-utils/components-Text-Text";

function BeamExample() {
  const container = useRef<HTMLDivElement>(null);
  const wallet = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const bank = useRef<HTMLDivElement>(null);
  const core = useRef<HTMLDivElement>(null);
  const ledger = useRef<HTMLDivElement>(null);
  const vault = useRef<HTMLDivElement>(null);

  const node = (ref: React.RefObject<HTMLDivElement | null>, icon: typeof Wallet, label: string) => (
    <div ref={ref} className="relative z-10 flex flex-col items-center gap-1.5">
      <Surface
        variant="floating"
        className="h-12 w-12 items-center justify-center rounded-full border border-[#262C34]"
      >
        <IconTile icon={icon} tone="muted" size="sm" />
      </Surface>
      <Text size="micro" tone="faint">
        {label}
      </Text>
    </div>
  );

  return (
    <div
      ref={container}
      className="relative flex w-full items-center justify-between gap-6 overflow-hidden rounded-[var(--radius-card)] border border-[#262C34] bg-[#12161C] p-8"
    >
      <div className="flex flex-col gap-8">
        {node(wallet, Wallet, "Wallet")}
        {node(card, CreditCard, "Cards")}
        {node(bank, Landmark, "Bank")}
      </div>

      {node(core, Cloud, "Core")}

      <div className="flex flex-col gap-8">
        {node(ledger, Database, "Ledger")}
        {node(vault, Shield, "Vault")}
      </div>

      <AnimatedBeam containerRef={container} fromRef={wallet} toRef={core} curvature={-34} duration={2.6} />
      <AnimatedBeam containerRef={container} fromRef={card} toRef={core} curvature={0} duration={2.6} delay={0.5} />
      <AnimatedBeam containerRef={container} fromRef={bank} toRef={core} curvature={34} duration={2.6} delay={1} />
      <AnimatedBeam containerRef={container} fromRef={core} toRef={ledger} curvature={-28} duration={2.2} delay={0.8} />
      <AnimatedBeam containerRef={container} fromRef={core} toRef={vault} curvature={28} duration={2.2} delay={1.4} />
    </div>
  );
}

export default function Demo() {
  return (
    <div data-component-demo className="flex min-h-screen w-full items-center justify-center bg-[#0B0E11] p-8 text-[#F0F3F6]">
      <div className="w-full max-w-[620px]">
        <BeamExample />
      </div>
    </div>
  );
}
