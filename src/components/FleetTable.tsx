import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Rocket } from "lucide-react";
import type { FleetState, ShipData } from "@/types";
import { cn } from "@/lib/utils";

type Props = {
  state: FleetState;
  selfId: string;
  /** Key of the ship the local member is crewing — highlights that row. */
  crewedShipKey?: string;
  /** Dense one-line rows with no ship images. */
  compact?: boolean;
};

/** One table row per ship — member-owned ships and open ships alike. */
type ShipRow = {
  key: string; // member id (member ship) or open ship id
  data: ShipData;
  ownerName: string | null; // null for an open ship
  ownerRole: string | null;
  isOpenShip: boolean;
};

/**
 * Read-only overview of the fleet: one fixed-height row per ship with a
 * seats summary. Click a row to expand its full crew roster.
 */
export function FleetTable({
  state,
  selfId,
  crewedShipKey,
  compact,
}: Props) {
  const { members, assignments, open_ships, slots } = state;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const memberById = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members],
  );

  // One row per ship, biggest first; member ships then open ships.
  const rows = useMemo(() => {
    const list: ShipRow[] = [];
    for (const m of members) {
      const a = assignments[m.id];
      if (a) {
        list.push({
          key: m.id,
          data: a.ship_data,
          ownerName: m.display_name,
          ownerRole: m.role,
          isOpenShip: false,
        });
      }
    }
    for (const os of open_ships) {
      list.push({
        key: os.id,
        data: os.ship_data,
        ownerName: null,
        ownerRole: null,
        isOpenShip: true,
      });
    }
    return list.sort(
      (a, b) =>
        b.data.size - a.data.size || a.data.name.localeCompare(b.data.name),
    );
  }, [members, assignments, open_ships]);

  // Genuinely idle pilots — no ship and not crewing anyone else's.
  const seatedIds = new Set(
    slots.filter((s) => s.filled_by_member_id).map((s) => s.filled_by_member_id),
  );
  const pilotsWithoutShip = members.filter(
    (m) => !assignments[m.id] && !seatedIds.has(m.id),
  );

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (rows.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-ink-faint">
        No ships in this fleet yet. Pick one, or have the creator add some.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-xl border border-edge">
        <table className="w-full min-w-[460px] border-collapse text-left text-sm">
          <thead>
            <tr className="bg-panel-2 text-[11px] uppercase tracking-wide text-ink-faint">
              <th className="px-3 py-2 font-medium">Ship</th>
              <th className="px-3 py-2 font-medium">Owner</th>
              <th className="px-3 py-2 font-medium">Seats</th>
              <th className="w-8 px-3 py-2" aria-label="Expand" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const shipSlots = slots
                .filter((s) => s.ship_member_id === row.key)
                .sort((a, b) => a.position - b.position);
              const filled = shipSlots.filter(
                (s) => s.filled_by_member_id,
              ).length;
              const isMine = !row.isOpenShip && row.key === selfId;
              const isCrewedByMe = row.key === crewedShipKey;
              const isExpanded = expanded.has(row.key);
              const full = filled === shipSlots.length;
              const d = row.data;

              return (
                <Fragment key={row.key}>
                  <tr
                    onClick={() => toggle(row.key)}
                    aria-expanded={isExpanded}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggle(row.key);
                      }
                    }}
                    className={cn(
                      "cursor-pointer border-t border-edge align-middle transition-colors",
                      compact ? "h-9" : "h-14",
                      "hover:bg-panel-2 focus-visible:bg-panel-2 focus-visible:outline-none",
                      isMine && "bg-accent/5",
                      isCrewedByMe && "bg-accent/10",
                    )}
                  >
                    <td className="px-3">
                      {compact ? (
                        <p className="truncate">
                          <span className="font-semibold">{d.name}</span>{" "}
                          <span className="text-xs text-ink-faint">
                            {d.manufacturerCode} · {d.role}
                          </span>
                        </p>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="relative h-9 w-14 shrink-0 overflow-hidden rounded bg-void">
                            {d.image ? (
                              <img
                                src={d.image}
                                alt={d.name}
                                loading="lazy"
                                className="size-full object-cover"
                              />
                            ) : (
                              <div className="flex size-full items-center justify-center">
                                <Rocket
                                  size={14}
                                  className="text-edge-bright"
                                />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold leading-tight">
                              {d.name}
                            </p>
                            <p className="truncate text-xs text-ink-faint">
                              {d.manufacturerCode} · {d.role}
                            </p>
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="px-3">
                      {row.isOpenShip ? (
                        <span className="text-xs italic text-ink-faint">
                          Open ship
                        </span>
                      ) : (
                        <>
                          <p className="truncate font-semibold text-accent">
                            {row.ownerName}
                            {isMine && (
                              <span className="font-medium text-ink-faint">
                                {" "}
                                (you)
                              </span>
                            )}
                            {compact && row.ownerRole && (
                              <span className="text-xs font-normal text-ink-faint">
                                {` · ${row.ownerRole}`}
                              </span>
                            )}
                          </p>
                          {!compact && row.ownerRole && (
                            <p className="truncate text-xs text-ink-faint">
                              {row.ownerRole}
                            </p>
                          )}
                        </>
                      )}
                    </td>

                    <td className="px-3 tabular-nums">
                      <span className={full ? "text-good" : "text-ink-dim"}>
                        {filled}/{shipSlots.length}
                      </span>
                    </td>

                    <td className="px-3 text-ink-faint">
                      {isExpanded ? (
                        <ChevronDown size={16} />
                      ) : (
                        <ChevronRight size={16} />
                      )}
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-void/40">
                      <td
                        colSpan={4}
                        className="border-t border-edge/60 px-3 py-2.5"
                      >
                        <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                          {shipSlots.map((slot) => {
                            const occ = slot.filled_by_member_id
                              ? memberById.get(slot.filled_by_member_id)
                              : undefined;
                            return (
                              <li
                                key={slot.id}
                                className="flex gap-2 text-xs"
                              >
                                <span className="w-24 shrink-0 text-ink-faint">
                                  {slot.label}
                                </span>
                                {occ ? (
                                  <span className="truncate font-medium text-accent">
                                    {occ.display_name}
                                    {occ.id === selfId && (
                                      <span className="text-ink-faint">
                                        {" "}
                                        (you)
                                      </span>
                                    )}
                                    {occ.role && (
                                      <span className="text-ink-dim">
                                        {` · ${occ.role}`}
                                      </span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="italic text-ink-faint">
                                    open
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {pilotsWithoutShip.length > 0 && (
        <p className="text-xs text-ink-faint">
          <span className="font-medium text-ink-dim">No ship yet:</span>{" "}
          {pilotsWithoutShip.map((m, i) => (
            <span key={m.id}>
              {i > 0 && ", "}
              <span className="font-medium text-accent">
                {m.display_name}
              </span>
              {m.id === selfId && " (you)"}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
