import { Rocket, RefreshCw, Trash2, Users } from "lucide-react";
import { Button } from "./ui/Button";
import type { ShipAssignment } from "@/types";

type Props = {
  assignment: ShipAssignment | undefined;
  isSelf: boolean;
  /** Self, or the fleet owner — may remove this ship. */
  canManage: boolean;
  onPickShip: () => void;
  onRemoveShip: () => void;
};

export function ShipPanel({
  assignment,
  isSelf,
  canManage,
  onPickShip,
  onRemoveShip,
}: Props) {
  if (!assignment) {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-xs text-ink-dim">
          <Rocket size={14} className="text-ink-faint" />
          {isSelf ? "No ship picked" : "No ship selected"}
        </span>
        {isSelf && (
          <Button size="sm" onClick={onPickShip}>
            Pick ship
          </Button>
        )}
      </div>
    );
  }

  const ship = assignment.ship_data;

  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5">
      <div className="relative h-11 w-[68px] shrink-0 overflow-hidden rounded bg-void">
        {ship.image ? (
          <img
            src={ship.image}
            alt={ship.name}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Rocket size={16} className="text-edge-bright" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight">
          {ship.name}
        </p>
        <p className="flex items-center gap-1.5 truncate text-xs text-ink-dim">
          <span className="truncate">
            {ship.manufacturerCode} · {ship.role}
          </span>
          <span className="inline-flex shrink-0 items-center gap-0.5 text-ink-faint">
            <Users size={11} /> {ship.crew}
          </span>
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {isSelf && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onPickShip}
            aria-label="Change ship"
            title="Change ship"
            className="px-2"
          >
            <RefreshCw size={13} />
          </Button>
        )}
        {canManage && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onRemoveShip}
            aria-label="Remove ship"
            title={isSelf ? "Remove ship" : "Remove this pilot's ship"}
            className="px-2 hover:text-danger"
          >
            <Trash2 size={13} />
          </Button>
        )}
      </div>
    </div>
  );
}
