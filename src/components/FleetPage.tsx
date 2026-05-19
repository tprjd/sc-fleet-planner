import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Armchair, EyeOff, LayoutGrid, Plus, Rows3, Table2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Spinner } from "./ui/Spinner";
import { Modal } from "./ui/Modal";
import { FleetHeader } from "./FleetHeader";
import { FleetChatPanel } from "./FleetChatPanel";
import { MemberCard } from "./MemberCard";
import { OpenShipCard } from "./OpenShipCard";
import { FleetTable } from "./FleetTable";
import { ParticipantSidebar } from "./ParticipantSidebar";
import { ShipPickerModal } from "./ShipPickerModal";
import { NotFound } from "./NotFound";
import { useFleet } from "@/hooks/useFleet";
import { useLocalIdentity } from "@/hooks/useLocalIdentity";
import { setCurrentFleetCode } from "@/lib/identity";
import { cn } from "@/lib/utils";
import type { Ship } from "@/types";

type FleetView = "cards" | "table";

export function FleetPage() {
  const { code } = useParams<{ code: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { memberId, displayName, setDisplayName } = useLocalIdentity();

  const createIntent = (location.state as { create?: string } | null)?.create;
  const { state, status, send, connectionStatus, chat } = useFleet(code, {
    create: createIntent,
    displayName,
  });

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"self" | "open">("self");
  const [joinName, setJoinName] = useState(displayName);

  const [view, setView] = useState<FleetView>(() =>
    localStorage.getItem("fp.fleetView") === "table" ? "table" : "cards",
  );
  function changeView(next: FleetView) {
    setView(next);
    localStorage.setItem("fp.fleetView", next);
  }

  const [hideEmptySeats, setHideEmptySeats] = useState(
    () => localStorage.getItem("fp.hideEmptySeats") !== "0",
  );
  function toggleHideEmpty() {
    setHideEmptySeats((prev) => {
      const next = !prev;
      localStorage.setItem("fp.hideEmptySeats", next ? "1" : "0");
      return next;
    });
  }

  const [tableCompact, setTableCompact] = useState(
    () => localStorage.getItem("fp.tableCompact") === "1",
  );
  function toggleTableCompact() {
    setTableCompact((prev) => {
      const next = !prev;
      localStorage.setItem("fp.tableCompact", next ? "1" : "0");
      return next;
    });
  }

  const isMember = useMemo(
    () => state?.members.some((m) => m.id === memberId) ?? false,
    [state, memberId],
  );

  useEffect(() => {
    if (status === "ready" && isMember && code) setCurrentFleetCode(code);
  }, [status, isMember, code]);

  // Mirror the server-confirmed display name back into local identity.
  // Rejected renames leave the broadcast value unchanged, so localStorage
  // never picks up a name the server didn't accept.
  const myDisplayName = state?.members.find(
    (m) => m.id === memberId,
  )?.display_name;
  useEffect(() => {
    if (myDisplayName && myDisplayName !== displayName) {
      setDisplayName(myDisplayName);
    }
  }, [myDisplayName, displayName, setDisplayName]);

  if (status === "not-found") return <NotFound />;

  if (status === "connecting" || !state) {
    return (
      <main className="flex min-h-[80vh] items-center justify-center">
        <Spinner className="size-7 text-accent" />
      </main>
    );
  }

  function handleJoin() {
    const name = joinName.trim();
    if (name.length < 2) return;
    setDisplayName(name);
    send({ t: "join", display_name: name });
  }

  function openPicker(mode: "self" | "open") {
    setPickerMode(mode);
    setPickerOpen(true);
  }

  function handlePick(ship: Ship) {
    setPickerOpen(false);
    send(
      pickerMode === "open"
        ? { t: "addShip", ship }
        : { t: "pickShip", ship },
    );
  }

  function handleReturnToShip() {
    if (!state) return;
    const target = state.slots
      .filter((s) => s.ship_member_id === memberId && !s.filled_by_member_id)
      .sort((a, b) => a.position - b.position)[0];
    if (!target) {
      toast.error("Your ship has no free seat to return to.");
      return;
    }
    send({ t: "claimSlot", slot_id: target.id });
  }

  const myAssignment = state.assignments[memberId];
  const isCreator = state.fleet.created_by === memberId;
  // "Crewing": holding a seat on a ship that isn't your own.
  const mySeat = state.slots.find(
    (s) => s.filled_by_member_id === memberId && s.ship_member_id !== memberId,
  );
  const iAmCrewing = Boolean(mySeat);
  const crewedShip = mySeat
    ? (state.assignments[mySeat.ship_member_id] ??
      state.open_ships.find((s) => s.id === mySeat.ship_member_id))
    : undefined;
  const crewedShipKey = mySeat?.ship_member_id;

  // Members crewing someone else's ship get no card of their own.
  const crewingElsewhereIds = new Set(
    state.slots
      .filter(
        (s) =>
          s.filled_by_member_id && s.ship_member_id !== s.filled_by_member_id,
      )
      .map((s) => s.filled_by_member_id),
  );
  const cardMembers = state.members.filter(
    (m) => !crewingElsewhereIds.has(m.id),
  );

  // Why a visitor can't join right now, if anything.
  const joinBlockedReason: "locked" | "full" | null = state.fleet.locked
    ? "locked"
    : state.fleet.max_members !== null &&
        state.members.length >= state.fleet.max_members
      ? "full"
      : null;

  return (
    <div className="flex min-h-screen flex-col">
      <FleetHeader
        state={state}
        isCreator={isCreator}
        connectionStatus={connectionStatus}
        send={send}
        onAfterLeave={() => navigate("/")}
      />

      <div className="flex flex-1 flex-col lg:flex-row">
        <ParticipantSidebar state={state} selfId={memberId} send={send} />

        <main className="min-w-0 flex-1 px-4 pb-16 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                {isCreator && (
                  <Button size="sm" onClick={() => openPicker("open")}>
                    <Plus size={14} /> Add ship
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {view === "cards" && (
                  <button
                    onClick={toggleHideEmpty}
                    aria-pressed={hideEmptySeats}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                      hideEmptySeats
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-edge text-ink-dim hover:text-ink",
                    )}
                  >
                    <EyeOff size={13} /> Hide empty seats
                  </button>
                )}
                {view === "table" && (
                  <button
                    onClick={toggleTableCompact}
                    aria-pressed={tableCompact}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                      tableCompact
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-edge text-ink-dim hover:text-ink",
                    )}
                  >
                    <Rows3 size={13} /> Compact
                  </button>
                )}
                <div
                  role="tablist"
                  aria-label="Fleet view"
                  className="inline-flex rounded-md border border-edge bg-panel p-0.5"
                >
                  {(
                    [
                      { id: "cards", label: "Cards", Icon: LayoutGrid },
                      { id: "table", label: "Table", Icon: Table2 },
                    ] as const
                  ).map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      role="tab"
                      aria-selected={view === id}
                      onClick={() => changeView(id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                        view === id
                          ? "bg-accent text-void"
                          : "text-ink-dim hover:text-ink",
                      )}
                    >
                      <Icon size={13} /> {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {iAmCrewing && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-edge bg-panel px-3 py-2">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-ink-dim">
                  <Armchair size={15} className="shrink-0 text-accent" />
                  You're crewing{" "}
                  <span className="font-medium text-ink">
                    {crewedShip?.ship_name ?? "another ship"}
                  </span>
                  {mySeat && (
                    <span className="text-ink-faint">· {mySeat.label}</span>
                  )}
                  {myAssignment && (
                    <span className="text-ink-faint">
                      · your {myAssignment.ship_name} is parked
                    </span>
                  )}
                </span>
                {myAssignment ? (
                  <Button size="sm" onClick={handleReturnToShip}>
                    Return to my ship
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => openPicker("self")}>
                    Pick your own ship
                  </Button>
                )}
              </div>
            )}

            {state.members.length === 0 ? (
              <p className="py-16 text-center text-sm text-ink-faint">
                No pilots in this fleet yet.
              </p>
            ) : view === "cards" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {cardMembers.map((member) => (
                  <MemberCard
                    key={member.id}
                    member={member}
                    state={state}
                    selfId={memberId}
                    crewedByMe={member.id === crewedShipKey}
                    hideEmptySeats={hideEmptySeats}
                    send={send}
                    onPickShip={() => openPicker("self")}
                  />
                ))}
                {state.open_ships.map((ship) => (
                  <OpenShipCard
                    key={ship.id}
                    openShip={ship}
                    state={state}
                    selfId={memberId}
                    crewedByMe={ship.id === crewedShipKey}
                    hideEmptySeats={hideEmptySeats}
                    isCreator={isCreator}
                    send={send}
                  />
                ))}
              </div>
            ) : (
              <FleetTable
                state={state}
                selfId={memberId}
                crewedShipKey={crewedShipKey}
                compact={tableCompact}
              />
            )}
          </div>
        </main>

        <FleetChatPanel
          state={state}
          chat={chat}
          selfId={memberId}
          isMember={isMember}
          isCreator={isCreator}
          canSend={isMember && connectionStatus === "connected"}
          send={send}
        />
      </div>

      {/* Ship picker — targets the local member, or adds an open ship. */}
      <ShipPickerModal
        open={pickerOpen}
        currentUuid={
          pickerMode === "self" ? myAssignment?.ship_uuid : undefined
        }
        onClose={() => setPickerOpen(false)}
        onPick={handlePick}
      />

      {/* Join prompt for visitors who aren't members of this fleet yet. */}
      <Modal
        open={status === "ready" && !isMember}
        onClose={() => navigate("/")}
        title={
          joinBlockedReason === "locked"
            ? "Fleet is locked"
            : joinBlockedReason === "full"
              ? "Fleet is full"
              : "Join this fleet"
        }
      >
        {joinBlockedReason === "locked" ? (
          <div className="flex flex-col gap-3 px-5 py-4 text-sm text-ink-dim">
            <p>
              The owner has locked fleet{" "}
              <span className="font-mono text-accent">{code}</span> to new
              pilots. Try again later, or ask the owner to unlock it.
            </p>
          </div>
        ) : joinBlockedReason === "full" ? (
          <div className="flex flex-col gap-3 px-5 py-4 text-sm text-ink-dim">
            <p>
              Fleet <span className="font-mono text-accent">{code}</span> is
              at capacity ({state.members.length}/{state.fleet.max_members}).
              Wait for a spot to free up.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 px-5 py-4">
            <p className="text-sm text-ink-dim">
              You're viewing fleet{" "}
              <span className="font-mono text-accent">{code}</span>. Enter a
              callsign to take a spot.
            </p>
            <Input
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              placeholder="Your callsign"
              maxLength={24}
              autoFocus
            />
          </div>
        )}
        <footer className="flex justify-end gap-2 border-t border-edge px-5 py-3.5">
          <Button variant="ghost" onClick={() => navigate("/")}>
            {joinBlockedReason ? "Back" : "Cancel"}
          </Button>
          {!joinBlockedReason && (
            <Button
              onClick={handleJoin}
              disabled={joinName.trim().length < 2}
            >
              Join
            </Button>
          )}
        </footer>
      </Modal>
    </div>
  );
}
