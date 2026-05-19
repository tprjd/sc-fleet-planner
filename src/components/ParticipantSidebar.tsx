import { useState } from "react";
import { Crown, Rows3, Trash2 } from "lucide-react";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { useNow } from "@/hooks/useNow";
import { cn, initial, timeAgo } from "@/lib/utils";
import type { ClientMsg, FleetState, Member } from "@/types";

type Props = {
  state: FleetState;
  selfId: string;
  send: (msg: ClientMsg) => void;
};

/**
 * Compact roster of everyone in the fleet, as a flush left-edge panel
 * below the header. Online status comes straight from live connections;
 * a header toggle collapses it to just names + status.
 */
export function ParticipantSidebar({ state, selfId, send }: Props) {
  const { members, assignments, open_ships, slots, fleet, online, last_seen } =
    state;
  const now = useNow(30_000); // keep relative times ticking
  const isFleetOwner = fleet.created_by === selfId;
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);
  const [compact, setCompact] = useState(
    () => localStorage.getItem("fp.sidebarCompact") === "1",
  );

  function toggleCompact() {
    setCompact((prev) => {
      const next = !prev;
      localStorage.setItem("fp.sidebarCompact", next ? "1" : "0");
      return next;
    });
  }

  function handleRemove() {
    if (!confirmRemove) return;
    send({ t: "removeMember", member_id: confirmRemove.id });
    setConfirmRemove(null);
  }

  return (
    <aside
      className={cn(
        "shrink-0 border border-l-0 border-edge bg-panel lg:w-56",
        "lg:sticky lg:top-0 lg:self-start lg:max-h-screen lg:overflow-y-auto",
      )}
    >
      <header className="flex items-center justify-between border-b border-edge px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          Pilots · {members.length}
        </span>
        <button
          onClick={toggleCompact}
          aria-pressed={compact}
          title={compact ? "Detailed view" : "Compact view"}
          className={cn(
            "rounded p-1 transition-colors",
            compact
              ? "bg-accent/10 text-accent"
              : "text-ink-faint hover:text-ink",
          )}
        >
          <Rows3 size={14} />
        </button>
      </header>
      <ul className="max-h-[40vh] overflow-y-auto lg:max-h-none lg:overflow-visible">
        {members.map((m) => {
          const ship = assignments[m.id];
          // Crewing another ship takes precedence over an owned (parked) ship.
          const seat = slots.find(
            (s) =>
              s.filled_by_member_id === m.id && s.ship_member_id !== m.id,
          );
          const crewedShip = seat
            ? (assignments[seat.ship_member_id] ??
              open_ships.find((s) => s.id === seat.ship_member_id))
            : undefined;
          const place = crewedShip
            ? `crewing ${crewedShip.ship_name}`
            : ship
              ? ship.ship_name
              : "No ship";
          const isSelf = m.id === selfId;
          const isOwner = m.id === fleet.created_by;
          const sub = [place, m.role].filter(Boolean).join(" · ");
          const isOnline = online.includes(m.id);
          const seen = last_seen[m.id];
          const joined = timeAgo(m.joined_at, now);

          return (
            <li
              key={m.id}
              className={cn(
                "flex items-center gap-2 border-b border-edge/50 px-3 last:border-b-0",
                compact ? "py-1.5" : "py-2",
              )}
            >
              <div className="relative shrink-0">
                <div
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-xs font-bold",
                    isSelf ? "bg-accent text-void" : "bg-edge text-ink",
                  )}
                >
                  {initial(m.display_name)}
                </div>
                <span
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-panel",
                    isOnline ? "bg-good" : "bg-edge-bright",
                  )}
                  title={isOnline ? "Online" : "Offline"}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="truncate text-sm font-semibold text-accent">
                    {m.display_name}
                  </span>
                  {isOwner && (
                    <Crown
                      size={12}
                      className="shrink-0 text-warn"
                      aria-label="Fleet owner"
                    />
                  )}
                  {isSelf && (
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-ink-faint">
                      you
                    </span>
                  )}
                </div>
                {!compact && (
                  <>
                    <p className="truncate text-xs text-ink-faint">{sub}</p>
                    <p className="truncate text-[10px] text-ink-faint">
                      Joined{" "}
                      {joined === "now" ? "just now" : `${joined} ago`}
                      {" · "}
                      {isOnline ? (
                        <span className="text-good">online</span>
                      ) : seen ? (
                        `last seen ${timeAgo(seen, now)} ago`
                      ) : (
                        "offline"
                      )}
                    </p>
                  </>
                )}
              </div>

              {isFleetOwner && !isSelf && (
                <button
                  onClick={() => setConfirmRemove(m)}
                  aria-label={`Remove ${m.display_name}`}
                  title="Remove from fleet"
                  className="shrink-0 rounded p-1 text-ink-faint transition-colors hover:bg-panel-2 hover:text-danger"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={confirmRemove !== null}
        title="Remove pilot?"
        destructive
        confirmLabel="Remove"
        body={
          <>
            Remove{" "}
            <span className="font-semibold text-ink">
              {confirmRemove?.display_name}
            </span>{" "}
            from the fleet? Their ship and crew seats are deleted, and any
            seat they were holding is freed.
          </>
        }
        onConfirm={handleRemove}
        onCancel={() => setConfirmRemove(null)}
      />
    </aside>
  );
}
