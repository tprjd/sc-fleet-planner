import { useState } from "react";
import { Rocket, Trash2, Users } from "lucide-react";
import { Badge } from "./ui/Badge";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { CrewSlotList } from "./CrewSlotList";
import { cn } from "@/lib/utils";
import type { ClientMsg, FleetState, OpenShip } from "@/types";

type Props = {
  openShip: OpenShip;
  state: FleetState;
  selfId: string;
  /** True when this is the ship the local member is crewing. */
  crewedByMe?: boolean;
  hideEmptySeats: boolean;
  isCreator: boolean;
  send: (msg: ClientMsg) => void;
};

/**
 * A creator-added ship with no owner — every seat (pilot included) is open
 * for anyone to claim. Seats are managed by the creator or the ship's pilot.
 */
export function OpenShipCard({
  openShip,
  state,
  selfId,
  crewedByMe,
  hideEmptySeats,
  isCreator,
  send,
}: Props) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const d = openShip.ship_data;

  const shipSlots = state.slots.filter(
    (s) => s.ship_member_id === openShip.id,
  );
  const filled = shipSlots.filter((s) => s.filled_by_member_id).length;
  const pilotSeat = shipSlots.find((s) => s.position === 0);
  const canManage = isCreator || pilotSeat?.filled_by_member_id === selfId;

  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-panel",
        crewedByMe ? "border-accent/50 bg-accent/5" : "border-edge",
      )}
    >
      <div className="flex items-center gap-2.5 border-b border-edge px-3 py-2">
        <div className="relative h-11 w-[68px] shrink-0 overflow-hidden rounded bg-void">
          {d.image ? (
            <img
              src={d.image}
              alt={d.name}
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
          <div className="flex items-center gap-1.5">
            <p className="min-w-0 flex-1 truncate text-sm font-semibold">
              {d.name}
            </p>
            <Badge tone="neutral">Open</Badge>
          </div>
          <p className="flex items-center gap-1.5 truncate text-xs text-ink-dim">
            <span className="truncate">
              {d.manufacturerCode} · {d.role}
            </span>
            <span className="inline-flex shrink-0 items-center gap-0.5 text-ink-faint">
              <Users size={11} /> {filled}/{shipSlots.length}
            </span>
          </p>
        </div>
        {isCreator && (
          <button
            onClick={() => setConfirmRemove(true)}
            aria-label="Remove ship"
            title="Remove ship"
            className="shrink-0 rounded p-1 text-ink-faint transition-colors hover:bg-panel-2 hover:text-danger"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      <CrewSlotList
        shipKey={openShip.id}
        state={state}
        selfId={selfId}
        canManage={canManage}
        hideEmptySeats={hideEmptySeats}
        send={send}
      />

      <ConfirmDialog
        open={confirmRemove}
        title="Remove ship?"
        destructive
        confirmLabel="Remove ship"
        body={
          <>
            Remove{" "}
            <span className="font-semibold text-ink">
              {openShip.ship_name}
            </span>{" "}
            from the fleet? Its crew seats are deleted and anyone seated is
            freed.
          </>
        }
        onConfirm={() => {
          setConfirmRemove(false);
          send({ t: "removeOpenShip", ship_id: openShip.id });
        }}
        onCancel={() => setConfirmRemove(false)}
      />
    </article>
  );
}
