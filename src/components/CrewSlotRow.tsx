import { useState } from "react";
import { Trash2, UserMinus, UserPlus } from "lucide-react";
import { cn, initial } from "@/lib/utils";
import type { ClientMsg, CrewSlot, Member } from "@/types";

type Props = {
  slot: CrewSlot;
  members: Member[];
  selfId: string;
  canManage: boolean;
  send: (msg: ClientMsg) => void;
};

export function CrewSlotRow({
  slot,
  members,
  selfId,
  canManage,
  send,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(slot.label);

  const occupant = slot.filled_by_member_id
    ? members.find((m) => m.id === slot.filled_by_member_id)
    : undefined;
  const filledByMe = slot.filled_by_member_id === selfId;
  const empty = !slot.filled_by_member_id;

  function saveLabel() {
    const label = draft.trim();
    setEditing(false);
    if (!label || label === slot.label) {
      setDraft(slot.label);
      return;
    }
    send({ t: "renameSlot", slot_id: slot.id, label });
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-md border px-2 py-1 transition-colors",
        empty
          ? "border-dashed border-edge bg-transparent"
          : "border-edge bg-panel-2",
      )}
    >
      <div
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
          empty
            ? "border border-dashed border-edge-bright text-ink-faint"
            : filledByMe
              ? "bg-accent text-void"
              : "bg-edge text-ink",
        )}
      >
        {occupant ? initial(occupant.display_name) : ""}
      </div>

      {editing ? (
        <input
          value={draft}
          autoFocus
          maxLength={28}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={saveLabel}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveLabel();
            if (e.key === "Escape") {
              setDraft(slot.label);
              setEditing(false);
            }
          }}
          className="h-5 min-w-0 flex-1 rounded border border-accent bg-void px-1.5 text-xs text-ink focus:outline-none"
        />
      ) : (
        <button
          type="button"
          disabled={!canManage}
          onClick={() => canManage && setEditing(true)}
          className={cn(
            "min-w-0 flex-1 truncate text-left text-xs",
            canManage ? "cursor-text hover:text-accent" : "cursor-default",
          )}
          title={canManage ? "Rename seat" : undefined}
        >
          {occupant ? (
            <>
              <span className="font-medium text-accent">
                {occupant.display_name}
              </span>
              {filledByMe && <span className="text-ink-faint"> (you)</span>}
              <span className="text-ink-dim"> · {slot.label}</span>
            </>
          ) : (
            <span className="font-medium text-ink">{slot.label}</span>
          )}
        </button>
      )}

      {empty ? (
        <button
          onClick={() => send({ t: "claimSlot", slot_id: slot.id })}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-accent transition-colors hover:bg-accent/10"
        >
          <UserPlus size={12} /> Claim
        </button>
      ) : filledByMe ? (
        <button
          onClick={() => send({ t: "vacateSlot", slot_id: slot.id })}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-ink-dim transition-colors hover:bg-panel hover:text-warn"
        >
          <UserMinus size={12} /> Vacate
        </button>
      ) : null}

      {canManage && (
        <button
          onClick={() => send({ t: "removeSlot", slot_id: slot.id })}
          aria-label="Remove seat"
          className="rounded p-1 text-ink-faint transition-colors hover:bg-panel hover:text-danger"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}
