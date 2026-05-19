import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  tone?: "accent" | "neutral" | "warn" | "good";
  className?: string;
};

const TONES = {
  accent: "bg-accent/12 text-accent border-accent/25",
  neutral: "bg-panel-2 text-ink-dim border-edge",
  warn: "bg-warn/12 text-warn border-warn/30",
  good: "bg-good/12 text-good border-good/30",
} as const;

export function Badge({ children, tone = "neutral", className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
