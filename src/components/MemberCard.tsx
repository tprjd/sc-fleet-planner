import { useEffect, useRef, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { Badge } from "./ui/Badge";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { ShipPanel } from "./ShipPanel";
import { CrewSlotList } from "./CrewSlotList";
import { cn, initial } from "@/lib/utils";
import type { ClientMsg, FleetState, Member } from "@/types";

type Props = {
  member: Member;
  state: FleetState;
  selfId: string;
  /** True when this is the ship the local member is crewing. */
  crewedByMe?: boolean;
  /** Hide empty crew seats, showing a "claim a seat" button instead. */
  hideEmptySeats: boolean;
  send: (msg: ClientMsg) => void;
  onPickShip: () => void;
};

export function MemberCard({
  member,
  state,
  selfId,
  crewedByMe,
  hideEmptySeats,
  send,
  onPickShip,
}: Props) {
  const isSelf = member.id === selfId;
  const isFleetOwner = state.fleet.created_by === selfId;
  // Self can manage their own card; the fleet owner can manage anyone's.
  const canManage = isSelf || isFleetOwner;
  const assignment = state.assignments[member.id];

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(member.display_name);
  const [confirmRemoveShip, setConfirmRemoveShip] = useState(false);
  const [roleDraft, setRoleDraft] = useState(member.role ?? "");
  const [roleFocused, setRoleFocused] = useState(false);
  const cancelRoleEdit = useRef(false);

  // Keep the role draft in sync with broadcast updates while not editing.
  useEffect(() => {
    if (!roleFocused) setRoleDraft(member.role ?? "");
  }, [member.role, roleFocused]);

  const roleDirty = roleDraft.trim() !== (member.role ?? "");

  function saveName() {
    const name = draft.trim();
    setEditing(false);
    if (name.length < 2) {
      setDraft(member.display_name);
      return;
    }
    // localStorage is updated by the FleetPage sync effect once the
    // server confirms the rename, so a rejected name doesn't stick.
    send({ t: "setName", name });
  }

  function saveRole() {
    const role = roleDraft.trim();
    if (role === (member.role ?? "")) return;
    send({ t: "setRole", member_id: member.id, role });
  }

  function handleRemoveShip() {
    setConfirmRemoveShip(false);
    send({ t: "removeShip", member_id: member.id });
  }

  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-panel",
        isSelf
          ? "border-accent/40"
          : crewedByMe
            ? "border-accent/50 bg-accent/5"
            : "border-edge",
      )}
    >
      <header className="flex items-center gap-2 border-b border-edge px-3 py-2">
        <div
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
            isSelf ? "bg-accent text-void" : "bg-edge text-ink",
          )}
        >
          {initial(member.display_name)}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            {editing ? (
              <input
                value={draft}
                autoFocus
                maxLength={24}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") {
                    setDraft(member.display_name);
                    setEditing(false);
                  }
                }}
                className="h-6 min-w-0 flex-1 rounded border border-accent bg-void px-1.5 text-sm font-semibold text-ink focus:outline-none"
              />
            ) : (
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-accent">
                {member.display_name}
              </span>
            )}

            {isSelf && <Badge tone="accent">You</Badge>}
            {!isSelf && member.id === state.fleet.created_by && (
              <Badge tone="neutral">Owner</Badge>
            )}

            {isSelf && !editing && (
              <button
                onClick={() => {
                  setDraft(member.display_name);
                  setEditing(true);
                }}
                aria-label="Edit callsign"
                className="rounded p-1 text-ink-faint transition-colors hover:bg-panel-2 hover:text-ink"
              >
                <Pencil size={13} />
              </button>
            )}
            {isSelf && editing && (
              <div className="flex gap-0.5">
                <button
                  onClick={saveName}
                  aria-label="Save"
                  className="rounded p-1 text-good hover:bg-panel-2"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => {
                    setDraft(member.display_name);
                    setEditing(false);
                  }}
                  aria-label="Cancel"
                  className="rounded p-1 text-ink-faint hover:bg-panel-2"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Role — editable by self or the fleet owner, plain text otherwise */}
          {canManage ? (
            <div className="flex items-center gap-1">
              <input
                value={roleDraft}
                placeholder="Add a role…"
                maxLength={32}
                aria-label="Fleet role"
                onChange={(e) => setRoleDraft(e.target.value)}
                onFocus={() => setRoleFocused(true)}
                onBlur={() => {
                  setRoleFocused(false);
                  if (cancelRoleEdit.current) {
                    cancelRoleEdit.current = false;
                    setRoleDraft(member.role ?? "");
                    return;
                  }
                  saveRole();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") {
                    cancelRoleEdit.current = true;
                    e.currentTarget.blur();
                  }
                }}
                className="h-6 min-w-0 flex-1 rounded border border-edge bg-void px-1.5 text-xs text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
              />
              {roleDirty && (
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={saveRole}
                  aria-label="Save role"
                  title="Save role"
                  className="shrink-0 rounded border border-edge p-1 text-good transition-colors hover:bg-panel-2"
                >
                  <Check size={13} />
                </button>
              )}
            </div>
          ) : (
            member.role && (
              <span className="truncate text-xs text-ink-dim">
                {member.role}
              </span>
            )
          )}
        </div>
      </header>

      <ShipPanel
        assignment={assignment}
        isSelf={isSelf}
        canManage={canManage && Boolean(assignment)}
        onPickShip={onPickShip}
        onRemoveShip={() => setConfirmRemoveShip(true)}
      />

      {assignment && (
        <CrewSlotList
          shipKey={assignment.member_id}
          state={state}
          selfId={selfId}
          canManage={canManage}
          hideEmptySeats={hideEmptySeats}
          send={send}
        />
      )}

      <ConfirmDialog
        open={confirmRemoveShip}
        title="Remove ship?"
        destructive
        confirmLabel="Remove ship"
        body={
          <>
            Remove{" "}
            <span className="font-semibold text-ink">
              {assignment?.ship_name}
            </span>{" "}
            from {isSelf ? "your" : `${member.display_name}'s`} loadout? All of
            its crew seats are deleted and anyone seated is freed.
          </>
        }
        onConfirm={handleRemoveShip}
        onCancel={() => setConfirmRemoveShip(false)}
      />
    </article>
  );
}
