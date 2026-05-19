import { Rocket, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Ship } from "@/types";

type Props = {
  ship: Ship;
  selected: boolean;
  onPick: (ship: Ship) => void;
};

export function ShipCard({ ship, selected, onPick }: Props) {
  return (
    <button
      onClick={() => onPick(ship)}
      className={cn(
        "group flex flex-col overflow-hidden rounded-lg border bg-panel-2 text-left transition-colors",
        selected
          ? "border-accent ring-1 ring-accent"
          : "border-edge hover:border-edge-bright",
      )}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-void">
        {ship.image ? (
          <img
            src={ship.image}
            alt={ship.name}
            loading="lazy"
            className="size-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Rocket size={28} className="text-edge-bright" />
          </div>
        )}
        <span className="absolute bottom-1 right-1 inline-flex items-center gap-1 rounded bg-void/85 px-1.5 py-0.5 text-[11px] text-ink-dim">
          <Users size={11} /> {ship.crew}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 p-2.5">
        <span className="truncate text-xs font-semibold text-ink">
          {ship.name}
        </span>
        <span className="truncate text-[11px] text-ink-faint">
          {ship.manufacturerCode} · {ship.role}
        </span>
      </div>
    </button>
  );
}
