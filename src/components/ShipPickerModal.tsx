import { useDeferredValue, useMemo, useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import { Modal } from "./ui/Modal";
import { Input } from "./ui/Input";
import { Spinner } from "./ui/Spinner";
import { ShipCard } from "./ShipCard";
import { useAllShips } from "@/hooks/useAllShips";
import { cn } from "@/lib/utils";
import type { Ship } from "@/types";

type Props = {
  open: boolean;
  currentUuid?: string;
  onClose: () => void;
  onPick: (ship: Ship) => void;
};

/** Classification filter chips — each has a keyword predicate. */
const FILTERS: { id: string; label: string; match?: (haystack: string) => boolean }[] = [
  { id: "all", label: "All" },
  { id: "combat", label: "Combat", match: (h) => /combat|fighter|gunship|bomber|military|interceptor/.test(h) },
  { id: "cargo", label: "Cargo", match: (h) => /cargo|transport|freight|hauler/.test(h) },
  { id: "mining", label: "Mining", match: (h) => /mining/.test(h) },
  { id: "salvage", label: "Salvage", match: (h) => /salv/.test(h) },
  { id: "medical", label: "Medical", match: (h) => /medical|medic/.test(h) },
  { id: "explore", label: "Exploration", match: (h) => /explor|expedition|pathfinder/.test(h) },
  { id: "capital", label: "Capital", match: (h) => /capital|frigate|destroyer|corvette/.test(h) },
];

const MAX_RESULTS = 180;

export function ShipPickerModal({ open, currentUuid, onClose, onPick }: Props) {
  const { ships, usedFallback, isLoading } = useAllShips();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const deferredQuery = useDeferredValue(query);

  const results = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const active = FILTERS.find((f) => f.id === filter);
    return ships.filter((s) => {
      if (active?.match) {
        const haystack = `${s.classification} ${s.role}`.toLowerCase();
        if (!active.match(haystack)) return false;
      }
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.gameName.toLowerCase().includes(q) ||
        s.manufacturer.toLowerCase().includes(q) ||
        s.role.toLowerCase().includes(q)
      );
    });
  }, [ships, deferredQuery, filter]);

  const shown = results.slice(0, MAX_RESULTS);

  return (
    <Modal open={open} onClose={onClose} title="Pick a ship" size="lg">
      <div className="flex flex-col gap-3 border-b border-edge px-4 py-3">
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ships, manufacturers, roles…"
            autoFocus
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                filter === f.id
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-edge text-ink-dim hover:border-edge-bright hover:text-ink",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {usedFallback && (
          <p className="flex items-center gap-1.5 text-xs text-warn">
            <AlertTriangle size={13} />
            Ship API offline — showing a small bundled list.
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner className="size-6 text-accent" />
          </div>
        ) : shown.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-faint">
            No ships match your search.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {shown.map((ship) => (
                <ShipCard
                  key={ship.uuid}
                  ship={ship}
                  selected={ship.uuid === currentUuid}
                  onPick={onPick}
                />
              ))}
            </div>
            {results.length > MAX_RESULTS && (
              <p className="pt-4 text-center text-xs text-ink-faint">
                Showing {MAX_RESULTS} of {results.length} — refine your search
                to narrow it down.
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
