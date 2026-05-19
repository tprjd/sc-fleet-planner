import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Rocket, Plus, LogIn } from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { useLocalIdentity } from "@/hooks/useLocalIdentity";
import { generateFleetCode, isValidCode, normalizeCode } from "@/lib/codes";

export function LandingPage() {
  const navigate = useNavigate();
  const { displayName, setDisplayName } = useLocalIdentity();

  const [callsign, setCallsign] = useState(displayName);
  const [fleetName, setFleetName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

  const trimmedCallsign = callsign.trim();
  const callsignOk = trimmedCallsign.length >= 2;

  function handleCreate() {
    if (!callsignOk) return;
    setDisplayName(trimmedCallsign);
    const code = generateFleetCode();
    // The create intent is read by FleetPage and passed to the room.
    navigate(`/fleet/${code}`, { state: { create: fleetName.trim() } });
  }

  function handleJoin() {
    if (!callsignOk) return;
    const code = normalizeCode(joinCode);
    if (!isValidCode(code)) {
      setJoinError("Fleet codes are 6 characters.");
      return;
    }
    setDisplayName(trimmedCallsign);
    navigate(`/fleet/${code}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-6 py-12">
      <header className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-14 items-center justify-center rounded-xl border border-edge bg-panel">
          <Rocket className="text-accent" size={26} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          Fleet <span className="text-accent">Planner</span>
        </h1>
        <p className="text-sm text-ink-dim">
          Spin up a fleet, share a code, and let your wing claim their seats.
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <label
          htmlFor="callsign"
          className="text-xs font-medium uppercase tracking-wide text-ink-faint"
        >
          Your callsign
        </label>
        <Input
          id="callsign"
          value={callsign}
          onChange={(e) => setCallsign(e.target.value)}
          placeholder="e.g. Maverick"
          maxLength={24}
          autoComplete="off"
        />
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-edge bg-panel p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Plus size={15} className="text-accent" /> Create a fleet
        </h2>
        <Input
          value={fleetName}
          onChange={(e) => setFleetName(e.target.value)}
          placeholder="Fleet name (optional)"
          maxLength={40}
          autoComplete="off"
        />
        <Button size="lg" onClick={handleCreate} disabled={!callsignOk}>
          Create fleet
        </Button>
      </section>

      <div className="flex items-center gap-3 text-xs text-ink-faint">
        <span className="h-px flex-1 bg-edge" /> or{" "}
        <span className="h-px flex-1 bg-edge" />
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-edge bg-panel p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <LogIn size={15} className="text-accent" /> Join a fleet
        </h2>
        <Input
          value={joinCode}
          onChange={(e) => {
            setJoinCode(e.target.value.toUpperCase());
            setJoinError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          placeholder="6-character code"
          maxLength={8}
          autoComplete="off"
          className="text-center font-mono text-lg uppercase tracking-[0.3em]"
        />
        <p className="min-h-[1rem] text-xs text-danger">{joinError}</p>
        <Button
          size="lg"
          variant="secondary"
          onClick={handleJoin}
          disabled={!callsignOk}
        >
          Join fleet
        </Button>
      </section>

      <p
        className={`text-center text-xs text-ink-faint ${
          callsignOk ? "invisible" : ""
        }`}
      >
        Enter a callsign (2+ characters) to get started.
      </p>
    </main>
  );
}
