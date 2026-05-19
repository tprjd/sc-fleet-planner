import { useState } from "react";
import {
  Check,
  Copy,
  Loader2,
  Lock,
  LockOpen,
  LogOut,
  Share2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/Button";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { clearToken, setCurrentFleetCode } from "@/lib/identity";
import { cn } from "@/lib/utils";
import type { ConnectionStatus } from "@/hooks/useFleet";
import type { ClientMsg, FleetState } from "@/types";

type Props = {
  state: FleetState;
  isCreator: boolean;
  connectionStatus: ConnectionStatus;
  send: (msg: ClientMsg) => void;
  onAfterLeave: () => void;
};

export function FleetHeader({
  state,
  isCreator,
  connectionStatus,
  send,
  onAfterLeave,
}: Props) {
  const { fleet, members, assignments, open_ships, slots } = state;
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const shipCount = Object.keys(assignments).length + open_ships.length;
  const filledSlots = slots.filter((s) => s.filled_by_member_id).length;
  const pilotsLabel = fleet.max_members
    ? `${members.length}/${fleet.max_members}`
    : `${members.length}`;

  async function copy(kind: "code" | "link") {
    const text =
      kind === "code"
        ? fleet.code
        : `${window.location.origin}/fleet/${fleet.code}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Couldn't copy to clipboard.");
    }
  }

  function handleLeave() {
    send({ t: "leave" });
    setCurrentFleetCode(null);
    clearToken(fleet.code);
    onAfterLeave();
  }

  function saveLimit(raw: string) {
    const trimmed = raw.trim();
    const n = trimmed === "" ? null : Math.floor(Number(trimmed));
    if (n !== null && (!Number.isFinite(n) || n < 1)) return;
    if (n === fleet.max_members) return;
    send({ t: "setMaxMembers", max_members: n });
  }

  return (
    <header className="mb-6 border-b border-edge bg-panel/60 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight">
              {fleet.name || "Unnamed Fleet"}
            </h1>
            {fleet.locked && (
              <span
                className="inline-flex items-center gap-1 rounded border border-warn/30 bg-warn/10 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-warn"
                title="No new pilots can join"
              >
                <Lock size={11} /> Locked
              </span>
            )}
            {connectionStatus === "reconnecting" && (
              <span
                className="inline-flex items-center gap-1 rounded border border-warn/30 bg-warn/10 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-warn"
                title="The connection dropped — actions are paused until it's back"
              >
                <Loader2 size={11} className="animate-spin" /> Reconnecting
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => copy("code")}
              title="Copy fleet code"
              className="inline-flex items-center gap-2 rounded-md border border-edge-bright bg-void px-3 py-1.5 font-mono text-xl font-bold tracking-[0.25em] text-accent transition-colors hover:border-accent"
            >
              {fleet.code}
              {copied === "code" ? (
                <Check size={16} className="text-good" />
              ) : (
                <Copy size={16} className="text-ink-faint" />
              )}
            </button>
            <Button size="sm" variant="ghost" onClick={() => copy("link")}>
              {copied === "link" ? <Check size={14} /> : <Share2 size={14} />}
              {copied === "link" ? "Link copied" : "Share link"}
            </Button>
          </div>
        </div>

        {isCreator && (
          <div className="flex flex-col items-stretch gap-1.5">
            <button
              onClick={() => send({ t: "setLocked", locked: !fleet.locked })}
              title={fleet.locked ? "Click to unlock" : "Click to lock"}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                fleet.locked
                  ? "border-warn/40 bg-warn/10 text-warn hover:bg-warn/15"
                  : "border-edge bg-void text-ink-dim hover:border-edge-bright hover:text-ink",
              )}
            >
              {fleet.locked ? <Lock size={13} /> : <LockOpen size={13} />}
              {fleet.locked ? "Locked" : "Open"}
            </button>
            <label
              title="Maximum pilots — blank for unlimited"
              className="flex items-center justify-center gap-1.5 rounded-md border border-edge bg-void px-2.5 py-1.5 text-xs"
            >
              <span className="text-ink-faint">Limit</span>
              <input
                key={fleet.max_members ?? "none"}
                type="number"
                min={1}
                defaultValue={fleet.max_members ?? ""}
                placeholder="∞"
                onBlur={(e) => saveLimit(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                className="h-5 w-10 bg-transparent text-center font-medium text-ink tabular-nums placeholder:text-ink-faint focus:outline-none"
              />
            </label>
          </div>
        )}

        <div className="flex items-center gap-5">
          <Stat label="Pilots" value={pilotsLabel} />
          <Stat label="Ships" value={shipCount} />
          <Stat label="Seats filled" value={`${filledSlots}/${slots.length}`} />
          <Button
            variant="danger"
            size="sm"
            onClick={() => setConfirmLeave(true)}
          >
            <LogOut size={14} /> Leave
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmLeave}
        title="Leave fleet?"
        destructive
        confirmLabel="Leave fleet"
        body={
          <span className="flex items-start gap-2">
            <Users size={16} className="mt-0.5 shrink-0 text-warn" />
            <span>
              Your ship and crew slots will be removed. If you're the last
              pilot, the fleet is deleted entirely.
            </span>
          </span>
        }
        onConfirm={handleLeave}
        onCancel={() => setConfirmLeave(false)}
      />
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col">
      <span className="text-lg font-semibold leading-tight tabular-nums">
        {value}
      </span>
      <span className="text-[11px] uppercase tracking-wide text-ink-faint">
        {label}
      </span>
    </div>
  );
}
