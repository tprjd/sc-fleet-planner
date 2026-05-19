import {
  Server,
  routePartykitRequest,
  type Connection,
  type ConnectionContext,
} from "partyserver";
import { defaultSlotLabels } from "../src/lib/slotLabels";
import type {
  ChatMessage,
  ClientMsg,
  FleetState,
  ServerMsg,
  ShipData,
  StoredFleet,
} from "../shared/protocol";

type Env = { Fleet: DurableObjectNamespace<FleetRoom> };
type ConnState = { memberId: string };

// ---- input caps -------------------------------------------------------
// The client UI enforces shorter limits; these are defenses against
// crafted messages that bypass the UI.

const MAX_NAME_LEN = 24; // display_name
const MAX_ROLE_LEN = 32; // fleet role
const MAX_LABEL_LEN = 28; // crew seat label
const MAX_FLEET_NAME_LEN = 40;
const MAX_SHIP_FIELD_LEN = 80;
const MAX_MFC_LEN = 20; // manufacturer code
const MAX_IMAGE_URL_LEN = 2048;
const MAX_SHIP_CREW = 30;
const MAX_SHIP_SIZE = 6;
const MAX_OPEN_SHIPS = 50;
const MAX_SLOTS_PER_SHIP = 30;
const MAX_MEMBER_LIMIT = 500; // upper bound for setMaxMembers
const MAX_CHAT_LEN = 500; // single chat message
const MAX_PINNED_LEN = 280; // owner-set pinned announcement
const CHAT_BUFFER_SIZE = 50; // recent messages held in memory only

// Per-connection token bucket. One bucket covers both chat and state
// mutations — a flooder can't bypass it by alternating message types.
const RATE_LIMIT_BURST = 10;
const RATE_LIMIT_REFILL_PER_SEC = 2;
// Distinct sockets allowed per memberId in one room.
const MAX_CONNECTIONS_PER_MEMBER = 5;
// Server-side floor for fleet code shape; client picks from a stricter
// alphabet, but we want a defense against hand-crafted DO names.
const FLEET_CODE_RE = /^[A-Z0-9]{4,8}$/;

type RateBucket = { tokens: number; lastRefill: number };

// Fleet GC: rooms with no activity (no connections, no mutations) for
// this long get purged on the next alarm firing.
const STALE_FLEET_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Trim and truncate a string-ish input. */
function clean(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Clamp a number into [min, max], falling back when not a finite number. */
function clamp(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v)
    ? Math.max(min, Math.min(max, Math.floor(v)))
    : fallback;
}

/** Normalize a client-supplied ShipData into a safe stored shape. */
function cleanShipData(input: unknown): ShipData {
  const o = (input && typeof input === "object" ? input : {}) as Record<
    string,
    unknown
  >;
  const image =
    typeof o.image === "string" && o.image.length <= MAX_IMAGE_URL_LEN
      ? o.image
      : null;
  return {
    uuid: clean(o.uuid, MAX_SHIP_FIELD_LEN) || "unknown",
    name: clean(o.name, MAX_SHIP_FIELD_LEN) || "Unnamed Ship",
    gameName: clean(o.gameName, MAX_SHIP_FIELD_LEN),
    manufacturer: clean(o.manufacturer, MAX_SHIP_FIELD_LEN) || "Unknown",
    manufacturerCode: clean(o.manufacturerCode, MAX_MFC_LEN) || "—",
    role: clean(o.role, MAX_SHIP_FIELD_LEN) || "Unclassified",
    classification: clean(o.classification, MAX_SHIP_FIELD_LEN) || "other",
    crew: clamp(o.crew, 1, MAX_SHIP_CREW, 1),
    size: clamp(o.size, 1, MAX_SHIP_SIZE, 1),
    image,
  };
}

/**
 * One Durable Object instance per fleet code. It owns the fleet state,
 * applies mutations atomically (a DO processes messages serially), and
 * broadcasts the full snapshot to every connected client.
 */
export class FleetRoom extends Server<Env> {
  static options = { hibernate: true };

  /** Persisted fleet state; null until created (or after the last member leaves). */
  fleet: StoredFleet | null = null;

  /** Recent chat — in-memory only, lost on DO hibernation. Members get a snapshot on connect. */
  chat: ChatMessage[] = [];

  /** Rate-limit token buckets keyed by connection id; reset by hibernation. */
  buckets: Map<string, RateBucket> = new Map();

  async onStart() {
    this.fleet = (await this.ctx.storage.get<StoredFleet>("fleet")) ?? null;
    // Backfill fields added to fleets persisted before they existed.
    if (this.fleet) {
      if (!this.fleet.open_ships) this.fleet.open_ships = [];
      if (typeof this.fleet.fleet.locked !== "boolean") {
        this.fleet.fleet.locked = false;
      }
      if (this.fleet.fleet.max_members === undefined) {
        this.fleet.fleet.max_members = null;
      }
      if (this.fleet.fleet.chat_pinned === undefined) {
        this.fleet.fleet.chat_pinned = null;
      }
      if (!this.fleet.last_activity_at) {
        this.fleet.last_activity_at = new Date().toISOString();
      }
      if (!this.fleet.tokens) this.fleet.tokens = {};
    }
  }

  async onConnect(conn: Connection<ConnState>, ctx: ConnectionContext) {
    const url = new URL(ctx.request.url);
    const memberId = url.searchParams.get("m");
    const providedToken = url.searchParams.get("t");
    if (!memberId) {
      conn.close(4000, "missing member id");
      return;
    }
    conn.setState({ memberId });

    // Phase 1 — read-only checks that may short-circuit without persist.
    if (!this.fleet && url.searchParams.get("create") === null) {
      conn.send(json({ t: "notFound" }));
      return;
    }
    // Reject creation attempts at oddly-shaped DO names so an attacker
    // can't squat thousands of arbitrary fleet codes.
    if (!this.fleet && !FLEET_CODE_RE.test(this.name)) {
      conn.send(json({ t: "error", message: "Invalid fleet code." }));
      conn.close(4002, "invalid fleet code");
      return;
    }
    // Cap how many sockets one memberId can hold in this room.
    let existingForMember = 0;
    for (const c of this.getConnections<ConnState>()) {
      if (c.id !== conn.id && c.state?.memberId === memberId) {
        existingForMember += 1;
      }
    }
    if (existingForMember >= MAX_CONNECTIONS_PER_MEMBER) {
      conn.send(
        json({
          t: "error",
          message: "Too many sessions open for this pilot — close other tabs.",
        }),
      );
      conn.close(4003, "connection limit");
      return;
    }
    const existingExpected = this.fleet?.tokens[memberId];
    const isExistingMember =
      this.fleet?.members.some((m) => m.id === memberId) ?? false;
    if (isExistingMember && existingExpected && providedToken !== existingExpected) {
      conn.send(
        json({
          t: "error",
          message:
            "Authentication failed for this fleet — refresh to start a new session.",
        }),
      );
      conn.close(4001, "invalid token");
      return;
    }

    // Phase 2 — snapshot then mutate + persist; roll back on storage failure.
    let issuedToken: string | null = null;
    const snapshot = snapshotFleet(this.fleet);
    try {
      if (!this.fleet) {
        const createName = url.searchParams.get("create")!;
        const displayName =
          clean(url.searchParams.get("name"), MAX_NAME_LEN) || "Pilot";
        const fleetName = clean(createName, MAX_FLEET_NAME_LEN);
        const now = new Date().toISOString();
        issuedToken = crypto.randomUUID();
        this.fleet = {
          fleet: {
            code: this.name,
            name: fleetName || null,
            created_at: now,
            created_by: memberId,
            locked: false,
            max_members: null,
            chat_pinned: null,
          },
          members: [
            { id: memberId, display_name: displayName, role: null, joined_at: now },
          ],
          assignments: {},
          open_ships: [],
          slots: [],
          last_seen: {},
          last_activity_at: now,
          tokens: { [memberId]: issuedToken },
        };
      } else if (isExistingMember) {
        // Mint on first contact with the token system, or echo the existing one.
        let expected = this.fleet.tokens[memberId];
        if (!expected) {
          expected = crypto.randomUUID();
          this.fleet.tokens[memberId] = expected;
        }
        issuedToken = expected;
      }
      // Visitors (not yet members) need no token; one is minted on `join`.
      if (this.fleet) {
        delete this.fleet.last_seen[memberId];
        this.fleet.last_activity_at = new Date().toISOString();
      }
      await this.persist();
    } catch (err) {
      this.fleet = snapshot;
      console.error("FleetRoom.onConnect persist failed:", err);
      conn.send(
        json({
          t: "error",
          message: "Couldn't open the fleet — try reconnecting.",
        }),
      );
      conn.close(1011, "persist failed");
      return;
    }

    // Phase 3 — post-persist effects. Safe to tell the client about the
    // token now because storage has the matching record.
    if (issuedToken) {
      conn.send(json({ t: "token", value: issuedToken }));
    }
    if (this.fleet) {
      this.scheduleAlarm();
      if (this.fleet.members.some((m) => m.id === memberId)) {
        conn.send(json({ t: "chatHistory", messages: this.chat }));
      }
    }
    this.sync();
  }

  async onMessage(conn: Connection<ConnState>, raw: string | ArrayBuffer) {
    const memberId = conn.state?.memberId;
    if (!this.fleet || !memberId || typeof raw !== "string") return;

    let msg: ClientMsg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    // `leave` is exempt so a panicking client can always escape even if
    // the room has rate-limited them.
    if (msg.t !== "leave" && !this.consumeRateToken(conn.id)) {
      conn.send(
        json({
          t: "error",
          message:
            msg.t === "sendChat"
              ? "Slow down — too many messages."
              : "Slow down — too many actions.",
        }),
      );
      return;
    }

    // Chat is broadcast-only — it doesn't mutate persisted state, so it
    // skips the apply/persist/sync pipeline used by everything else.
    if (msg.t === "sendChat") {
      try {
        this.handleSendChat(msg.text, memberId);
      } catch (err) {
        conn.send(
          json({
            t: "error",
            message: err instanceof Error ? err.message : "Action failed.",
          }),
        );
      }
      return;
    }

    const snapshot = snapshotFleet(this.fleet);
    try {
      this.apply(msg, memberId);
      if (this.fleet) {
        this.fleet.last_activity_at = new Date().toISOString();
      }
      await this.persist();
    } catch (err) {
      // Either apply() rejected the action or storage refused the write.
      // Either way, restore so the in-memory state matches storage.
      this.fleet = snapshot;
      conn.send(
        json({
          t: "error",
          message: err instanceof Error ? err.message : "Action failed.",
        }),
      );
      return;
    }

    // Post-persist: deliver token + chat snapshot now that storage has them.
    if (msg.t === "join" && this.fleet) {
      const token = this.fleet.tokens[memberId];
      if (token) conn.send(json({ t: "token", value: token }));
      conn.send(json({ t: "chatHistory", messages: this.chat }));
    }
    this.scheduleAlarm();
    this.sync();
  }

  async onClose(conn: Connection<ConnState>) {
    const memberId = conn.state?.memberId;
    this.buckets.delete(conn.id);
    if (this.fleet) {
      const snapshot = snapshotFleet(this.fleet);
      try {
        if (memberId && !this.isOnline(memberId, conn.id)) {
          this.fleet.last_seen[memberId] = new Date().toISOString();
        }
        this.fleet.last_activity_at = new Date().toISOString();
        await this.persist();
      } catch (err) {
        // Nothing to surface to the closing client; just keep memory and
        // storage aligned and rebroadcast the rolled-back state.
        this.fleet = snapshot;
        console.error("FleetRoom.onClose persist failed:", err);
      }
      this.scheduleAlarm();
    }
    this.sync();
  }

  /** Purge fleets with no activity in the last STALE_FLEET_MS. */
  async onAlarm() {
    if (!this.fleet) return;
    const hasConnections = [...this.getConnections()].length > 0;
    if (hasConnections) {
      // Open sockets count as activity — refresh and reschedule.
      const snapshot = snapshotFleet(this.fleet);
      try {
        this.fleet.last_activity_at = new Date().toISOString();
        await this.persist();
      } catch (err) {
        this.fleet = snapshot;
        console.error("FleetRoom.onAlarm refresh failed:", err);
      }
      this.scheduleAlarm();
      return;
    }
    const idleMs =
      Date.now() - new Date(this.fleet.last_activity_at).getTime();
    if (idleMs < STALE_FLEET_MS) {
      // A mutation refreshed activity after the alarm was set — re-arm.
      this.scheduleAlarm();
      return;
    }
    // Stale and empty: purge — clear storage first so memory doesn't drop
    // a fleet that storage still holds.
    try {
      await this.ctx.storage.deleteAll();
    } catch (err) {
      console.error("FleetRoom.onAlarm purge failed:", err);
      this.scheduleAlarm();
      return;
    }
    this.fleet = null;
    this.sync();
  }

  // ---- mutations ------------------------------------------------------

  /** Apply one client message. Throws on an invalid/disallowed action. */
  private apply(msg: ClientMsg, actor: string) {
    const f = this.fleet!;
    const isOwner = f.fleet.created_by === actor;
    const member = f.members.find((m) => m.id === actor);

    switch (msg.t) {
      case "join": {
        if (member) return;
        if (f.fleet.locked) {
          throw new Error("This fleet is locked to new pilots.");
        }
        if (
          f.fleet.max_members !== null &&
          f.members.length >= f.fleet.max_members
        ) {
          throw new Error("This fleet is full.");
        }
        const name = clean(msg.display_name, MAX_NAME_LEN) || "Pilot";
        if (this.nameTaken(name)) {
          throw new Error("That callsign is already taken in this fleet.");
        }
        f.members.push({
          id: actor,
          display_name: name,
          role: null,
          joined_at: new Date().toISOString(),
        });
        delete f.last_seen[actor];
        f.tokens[actor] = crypto.randomUUID();
        return;
      }
      case "setName": {
        if (!member) return;
        const name = clean(msg.name, MAX_NAME_LEN);
        if (!name || name === member.display_name) return;
        if (this.nameTaken(name, actor)) {
          throw new Error("That callsign is already taken.");
        }
        member.display_name = name;
        return;
      }
      case "setRole": {
        const target = f.members.find((m) => m.id === msg.member_id);
        if (!target) throw new Error("No such member.");
        if (msg.member_id !== actor && !isOwner) {
          throw new Error("Only the fleet owner can set another pilot's role.");
        }
        target.role = clean(msg.role, MAX_ROLE_LEN) || null;
        return;
      }
      case "pickShip": {
        if (!member) throw new Error("Join the fleet first.");
        const ship = cleanShipData(msg.ship);
        for (const s of f.slots) {
          if (s.filled_by_member_id === actor) s.filled_by_member_id = null;
        }
        f.assignments[actor] = {
          member_id: actor,
          ship_uuid: ship.uuid,
          ship_name: ship.name,
          ship_data: ship,
        };
        f.slots = f.slots.filter((s) => s.ship_member_id !== actor);
        defaultSlotLabels(ship.role, ship.crew).forEach((label, i) => {
          f.slots.push({
            id: crypto.randomUUID(),
            ship_member_id: actor,
            position: i,
            label,
            filled_by_member_id: i === 0 ? actor : null,
          });
        });
        return;
      }
      case "removeShip": {
        if (msg.member_id !== actor && !isOwner) {
          throw new Error("Not allowed.");
        }
        delete f.assignments[msg.member_id];
        f.slots = f.slots.filter((s) => s.ship_member_id !== msg.member_id);
        return;
      }
      case "addShip": {
        if (!isOwner) throw new Error("Only the fleet owner can add ships.");
        if (f.open_ships.length >= MAX_OPEN_SHIPS) {
          throw new Error("Too many ships in this fleet.");
        }
        const ship = cleanShipData(msg.ship);
        const shipId = `s_${crypto.randomUUID()}`;
        f.open_ships.push({
          id: shipId,
          ship_uuid: ship.uuid,
          ship_name: ship.name,
          ship_data: ship,
        });
        defaultSlotLabels(ship.role, ship.crew).forEach((label, i) => {
          f.slots.push({
            id: crypto.randomUUID(),
            ship_member_id: shipId,
            position: i,
            label,
            filled_by_member_id: null,
          });
        });
        return;
      }
      case "removeOpenShip": {
        if (!isOwner) throw new Error("Only the fleet owner can remove ships.");
        f.open_ships = f.open_ships.filter((s) => s.id !== msg.ship_id);
        f.slots = f.slots.filter((s) => s.ship_member_id !== msg.ship_id);
        return;
      }
      case "setLocked": {
        if (!isOwner) {
          throw new Error("Only the fleet owner can lock the fleet.");
        }
        f.fleet.locked = msg.locked;
        return;
      }
      case "setChatPinned": {
        if (!isOwner) {
          throw new Error("Only the fleet owner can pin a message.");
        }
        const text = clean(msg.text, MAX_PINNED_LEN);
        f.fleet.chat_pinned = text || null;
        return;
      }
      case "sendChat":
        return; // handled before apply()
      case "setMaxMembers": {
        if (!isOwner) {
          throw new Error("Only the fleet owner can set the member limit.");
        }
        if (msg.max_members !== null) {
          if (
            !Number.isFinite(msg.max_members) ||
            msg.max_members < 1
          ) {
            throw new Error("Member limit must be at least 1.");
          }
          if (msg.max_members > MAX_MEMBER_LIMIT) {
            throw new Error(
              `Member limit must be at most ${MAX_MEMBER_LIMIT}.`,
            );
          }
        }
        f.fleet.max_members = msg.max_members;
        return;
      }
      case "addSlot": {
        if (!this.canManageShip(msg.ship_member_id, actor)) {
          throw new Error("Not allowed.");
        }
        const exists =
          Boolean(f.assignments[msg.ship_member_id]) ||
          f.open_ships.some((s) => s.id === msg.ship_member_id);
        if (!exists) throw new Error("No such ship.");
        const shipSlots = f.slots.filter(
          (s) => s.ship_member_id === msg.ship_member_id,
        );
        if (shipSlots.length >= MAX_SLOTS_PER_SHIP) {
          throw new Error("This ship can't hold any more seats.");
        }
        const next =
          shipSlots.reduce((mx, s) => Math.max(mx, s.position), -1) + 1;
        f.slots.push({
          id: crypto.randomUUID(),
          ship_member_id: msg.ship_member_id,
          position: next,
          label: `Crew ${next}`,
          filled_by_member_id: null,
        });
        return;
      }
      case "removeSlot": {
        const slot = f.slots.find((s) => s.id === msg.slot_id);
        if (!slot) return;
        if (!this.canManageShip(slot.ship_member_id, actor)) {
          throw new Error("Not allowed.");
        }
        f.slots = f.slots.filter((s) => s.id !== msg.slot_id);
        return;
      }
      case "renameSlot": {
        const slot = f.slots.find((s) => s.id === msg.slot_id);
        if (!slot) return;
        if (!this.canManageShip(slot.ship_member_id, actor)) {
          throw new Error("Not allowed.");
        }
        slot.label = clean(msg.label, MAX_LABEL_LEN) || "Crew";
        return;
      }
      case "claimSlot": {
        if (!member) throw new Error("Join the fleet first.");
        const slot = f.slots.find((s) => s.id === msg.slot_id);
        if (!slot) throw new Error("That seat no longer exists.");
        if (slot.filled_by_member_id) throw new Error("That seat is taken.");
        for (const s of f.slots) {
          if (s.filled_by_member_id === actor) s.filled_by_member_id = null;
        }
        slot.filled_by_member_id = actor;
        return;
      }
      case "vacateSlot": {
        const slot = f.slots.find((s) => s.id === msg.slot_id);
        if (slot && slot.filled_by_member_id === actor) {
          slot.filled_by_member_id = null;
        }
        return;
      }
      case "removeMember": {
        if (!isOwner) throw new Error("Only the fleet owner can remove pilots.");
        this.dropMember(msg.member_id);
        return;
      }
      case "leave": {
        this.dropMember(actor);
        return;
      }
    }
  }

  /**
   * Token-bucket rate limiter shared between chat and state mutations.
   * One bucket per connection; on hibernation the map resets, which is
   * the lenient side of the failure mode.
   */
  private consumeRateToken(connId: string): boolean {
    const now = Date.now();
    const bucket = this.buckets.get(connId);
    if (!bucket) {
      this.buckets.set(connId, {
        tokens: RATE_LIMIT_BURST - 1,
        lastRefill: now,
      });
      return true;
    }
    const refill = ((now - bucket.lastRefill) / 1000) * RATE_LIMIT_REFILL_PER_SEC;
    bucket.tokens = Math.min(RATE_LIMIT_BURST, bucket.tokens + refill);
    bucket.lastRefill = now;
    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }

  /**
   * Append a chat line and fan it out to connected members. Doesn't
   * touch persisted state — the buffer is in-memory only and dies on DO
   * hibernation, matching the "no history" requirement.
   */
  private handleSendChat(rawText: string, actor: string) {
    const f = this.fleet!;
    const member = f.members.find((m) => m.id === actor);
    if (!member) throw new Error("Join the fleet first.");
    const text = clean(rawText, MAX_CHAT_LEN);
    if (!text) return; // silently drop empty messages
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      from_member_id: actor,
      from_name: member.display_name,
      text,
      ts: new Date().toISOString(),
    };
    this.chat.push(message);
    if (this.chat.length > CHAT_BUFFER_SIZE) {
      this.chat = this.chat.slice(-CHAT_BUFFER_SIZE);
    }
    // No persist / no alarm bump: open sockets already register as
    // activity in onAlarm, and chat is non-durable by design.
    const payload = json({ t: "chat", message });
    for (const c of this.getConnections<ConnState>()) {
      const mid = c.state?.memberId;
      if (mid && f.members.some((m) => m.id === mid)) c.send(payload);
    }
  }

  /** Remove a member and everything that cascades from it. */
  private dropMember(id: string) {
    const f = this.fleet!;
    const wasOwner = f.fleet.created_by === id;
    f.members = f.members.filter((m) => m.id !== id);
    delete f.assignments[id];
    delete f.last_seen[id];
    delete f.tokens[id];
    f.slots = f.slots.filter((s) => s.ship_member_id !== id); // their ship's seats
    for (const s of f.slots) {
      if (s.filled_by_member_id === id) s.filled_by_member_id = null; // free seats elsewhere
    }
    if (f.members.length === 0) {
      this.fleet = null; // empty fleet is dead
      return;
    }
    if (wasOwner) {
      // Transfer ownership to the earliest-joined remaining member.
      const heir = [...f.members].sort((a, b) =>
        a.joined_at.localeCompare(b.joined_at),
      )[0];
      f.fleet.created_by = heir.id;
    }
  }

  /** Set the next GC alarm for `last_activity_at + STALE_FLEET_MS`. */
  private scheduleAlarm() {
    if (!this.fleet) return;
    const t =
      new Date(this.fleet.last_activity_at).getTime() + STALE_FLEET_MS;
    void this.ctx.storage.setAlarm(t);
  }

  /** Case-insensitive callsign collision check, optionally excluding one member. */
  private nameTaken(name: string, excludeId?: string): boolean {
    const n = name.trim().toLowerCase();
    return this.fleet!.members.some(
      (m) =>
        m.id !== excludeId &&
        m.display_name.trim().toLowerCase() === n,
    );
  }

  /** Whether `actor` may edit the seats of the ship keyed by `shipKey`. */
  private canManageShip(shipKey: string, actor: string): boolean {
    const f = this.fleet!;
    if (f.fleet.created_by === actor) return true;
    if (f.assignments[shipKey]) return shipKey === actor; // member-owned ship
    // Open ship — the pilot is whoever holds its position-0 seat.
    const pilot = f.slots.find(
      (s) => s.ship_member_id === shipKey && s.position === 0,
    );
    return pilot?.filled_by_member_id === actor;
  }

  // ---- helpers --------------------------------------------------------

  private async persist() {
    if (this.fleet) await this.ctx.storage.put("fleet", this.fleet);
    else await this.ctx.storage.deleteAll();
  }

  /** Broadcast the current snapshot (or notFound if the fleet is gone). */
  private sync() {
    const payload: ServerMsg = this.fleet
      ? { t: "state", state: this.publicState() }
      : { t: "notFound" };
    this.broadcast(json(payload));
  }

  private publicState(): FleetState {
    const f = this.fleet!;
    const online = new Set<string>();
    for (const c of this.getConnections<ConnState>()) {
      const mid = c.state?.memberId;
      if (mid && f.members.some((m) => m.id === mid)) online.add(mid);
    }
    // Strip the private tokens map before broadcasting.
    const { tokens, ...publicFleet } = f;
    void tokens;
    return { ...publicFleet, online: [...online] };
  }

  private isOnline(memberId: string, excludeId?: string): boolean {
    for (const c of this.getConnections<ConnState>()) {
      if (c.id !== excludeId && c.state?.memberId === memberId) return true;
    }
    return false;
  }
}

function json(msg: ServerMsg): string {
  return JSON.stringify(msg);
}

/**
 * Deep copy of the fleet for rollback if a storage write fails. Without
 * this, an in-place mutation that didn't persist would still be visible
 * to the next broadcast — and silently revert on DO hibernation, since
 * storage wins on restart.
 */
function snapshotFleet(f: StoredFleet | null): StoredFleet | null {
  return f ? structuredClone(f) : null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routePartykitRequest(request, env)) ??
      new Response("Not found", { status: 404 })
    );
  },
};
