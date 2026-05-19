import { Plus, UserPlus } from "lucide-react";
import { CrewSlotRow } from "./CrewSlotRow";
import type { ClientMsg, FleetState } from "@/types";

type Props = {
  /** The ship these seats belong to — a member id or an open ship id. */
  shipKey: string;
  state: FleetState;
  selfId: string;
  canManage: boolean;
  hideEmptySeats: boolean;
  send: (msg: ClientMsg) => void;
};

export function CrewSlotList({
  shipKey,
  state,
  selfId,
  canManage,
  hideEmptySeats,
  send,
}: Props) {
  const slots = state.slots
    .filter((s) => s.ship_member_id === shipKey)
    .sort((a, b) => a.position - b.position);
  const freeSlots = slots.filter((s) => !s.filled_by_member_id);
  const visibleSlots = hideEmptySeats
    ? slots.filter((s) => s.filled_by_member_id)
    : slots;
  // If I already hold a seat here, seat-switching happens by clicking a
  // specific empty seat in the detailed view — the compact "Claim a seat"
  // shortcut shouldn't appear in that case.
  const iAmOnThisShip = slots.some((s) => s.filled_by_member_id === selfId);

  return (
    <div className="flex flex-col gap-1 border-t border-edge px-2.5 py-2">
      <p className="px-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
        Crew · {slots.filter((s) => s.filled_by_member_id).length}/
        {slots.length}
      </p>

      {visibleSlots.map((slot) => (
        <CrewSlotRow
          key={slot.id}
          slot={slot}
          members={state.members}
          selfId={selfId}
          canManage={canManage}
          send={send}
        />
      ))}

      {hideEmptySeats && freeSlots.length > 0 && !iAmOnThisShip && (
        <button
          onClick={() => send({ t: "claimSlot", slot_id: freeSlots[0].id })}
          className="flex items-center justify-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-accent/20"
        >
          <UserPlus size={12} /> Claim a seat · {freeSlots.length} free
        </button>
      )}

      {canManage && (
        <button
          onClick={() => send({ t: "addSlot", ship_member_id: shipKey })}
          className="flex items-center justify-center gap-1 rounded-md border border-dashed border-edge py-1 text-[11px] text-ink-faint transition-colors hover:border-accent/50 hover:text-accent"
        >
          <Plus size={12} /> Add seat
        </button>
      )}
    </div>
  );
}
