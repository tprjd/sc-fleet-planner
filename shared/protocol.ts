// Shared types — imported by both the React app and the Cloudflare Worker.
// The Durable Object is the single source of truth; clients render the
// snapshots it broadcasts and send action messages back.

/** Normalized ship — the wiki-API shape and the stored subset are identical. */
export type ShipData = {
  uuid: string;
  name: string;
  gameName: string;
  manufacturer: string;
  manufacturerCode: string;
  role: string;
  classification: string;
  crew: number;
  size: number;
  image: string | null;
};

export type Fleet = {
  code: string;
  name: string | null;
  created_at: string;
  created_by: string; // member id of the creator (the fleet owner)
  locked: boolean; // when true, no new members may join
  max_members: number | null; // member cap; null = unlimited
  chat_pinned: string | null; // owner-set announcement shown above the chat
};

export type Member = {
  id: string;
  display_name: string;
  role: string | null; // free-text fleet role
  joined_at: string;
};

export type ShipAssignment = {
  member_id: string;
  ship_uuid: string;
  ship_name: string;
  ship_data: ShipData;
};

/** A ship the fleet creator added that no member owns — its seats are open. */
export type OpenShip = {
  id: string; // "s_..." — distinct from member ids
  ship_uuid: string;
  ship_name: string;
  ship_data: ShipData;
};

/** One chat line. Ephemeral — server keeps a small ring buffer in memory only. */
export type ChatMessage = {
  id: string;
  from_member_id: string;
  from_name: string; // captured at send time so renames don't rewrite history
  text: string;
  ts: string;
};

export type CrewSlot = {
  id: string;
  ship_member_id: string; // the ship this seat belongs to: a member id, or an OpenShip id
  position: number;
  label: string;
  filled_by_member_id: string | null;
};

/** The fleet shape broadcast to clients — no server-side secrets. */
export type PublicFleet = {
  fleet: Fleet;
  members: Member[];
  assignments: Record<string, ShipAssignment>; // member-owned ships, keyed by member_id
  open_ships: OpenShip[]; // creator-added ships with no owner
  slots: CrewSlot[];
  last_seen: Record<string, string>; // member_id -> ISO time their last socket closed
  last_activity_at: string; // ISO time of the latest mutation/connection
};

/** Persisted in Durable Object storage. Includes per-member session
 *  tokens which are NEVER broadcast — only known to the room and the
 *  client they were issued to. */
export type StoredFleet = PublicFleet & {
  tokens: Record<string, string>; // member_id -> private session token
};

/** What the room broadcasts: the public state plus live presence. */
export type FleetState = PublicFleet & {
  online: string[]; // member ids with an open connection
};

// ---- client -> server -------------------------------------------------

export type ClientMsg =
  | { t: "join"; display_name: string }
  | { t: "setName"; name: string }
  | { t: "setRole"; member_id: string; role: string }
  | { t: "pickShip"; ship: ShipData }
  | { t: "removeShip"; member_id: string }
  | { t: "addShip"; ship: ShipData } // creator adds an open ship
  | { t: "removeOpenShip"; ship_id: string }
  | { t: "setLocked"; locked: boolean }
  | { t: "setMaxMembers"; max_members: number | null }
  | { t: "sendChat"; text: string }
  | { t: "setChatPinned"; text: string }
  | { t: "addSlot"; ship_member_id: string }
  | { t: "removeSlot"; slot_id: string }
  | { t: "renameSlot"; slot_id: string; label: string }
  | { t: "claimSlot"; slot_id: string }
  | { t: "vacateSlot"; slot_id: string }
  | { t: "removeMember"; member_id: string }
  | { t: "leave" };

// ---- server -> client -------------------------------------------------

export type ServerMsg =
  | { t: "state"; state: FleetState }
  | { t: "error"; message: string }
  | { t: "notFound" }
  | { t: "token"; value: string } // private — issued to the actor's connection only
  | { t: "chatHistory"; messages: ChatMessage[] } // sent to a member on (re)connect
  | { t: "chat"; message: ChatMessage }; // live append
