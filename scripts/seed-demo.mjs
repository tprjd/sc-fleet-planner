/**
 * Seeds the "ARMADA" demo fleet by replaying WebSocket actions against a
 * deployed FleetRoom. Idempotent-ish: re-running re-applies the actions.
 *
 *   node scripts/seed-demo.mjs [wss://host]
 *
 * Defaults to the production worker.
 */
const HOST =
  process.argv[2] ?? "wss://sc-fleet-planner.david05202.workers.dev";
const CODE = "ARMADA";
const FLEET_NAME = "Stanton Expeditionary Force";

// ---- ship catalog -----------------------------------------------------
const ships = {
  hammerhead: { name: "Hammerhead", mfc: "AEGS", mf: "Aegis Dynamics", role: "Gunship", cls: "combat", crew: 9, size: 5 },
  carrack: { name: "Carrack", mfc: "ANVL", mf: "Anvil Aerospace", role: "Expedition", cls: "exploration", crew: 6, size: 4 },
  connie: { name: "Constellation Andromeda", mfc: "RSI", mf: "Roberts Space Industries", role: "Multi-Role", cls: "multi", crew: 4, size: 3 },
  caterpillar: { name: "Caterpillar", mfc: "DRAK", mf: "Drake Interplanetary", role: "Cargo", cls: "transport", crew: 5, size: 4 },
  reclaimer: { name: "Reclaimer", mfc: "AEGS", mf: "Aegis Dynamics", role: "Salvage", cls: "salvage", crew: 5, size: 5 },
  six00i: { name: "600i Explorer", mfc: "ORIG", mf: "Origin Jumpworks", role: "Exploration", cls: "exploration", crew: 5, size: 4 },
  mole: { name: "MOLE", mfc: "ARGO", mf: "Argo Astronautics", role: "Mining", cls: "mining", crew: 4, size: 3 },
  apollo: { name: "Apollo Triage", mfc: "RSI", mf: "Roberts Space Industries", role: "Medical", cls: "medical", crew: 3, size: 3 },
  cutlass: { name: "Cutlass Black", mfc: "DRAK", mf: "Drake Interplanetary", role: "Multi-Role", cls: "multi", crew: 2, size: 2 },
  gladius: { name: "Gladius", mfc: "AEGS", mf: "Aegis Dynamics", role: "Light Fighter", cls: "combat", crew: 1, size: 1 },
  arrow: { name: "Arrow", mfc: "ANVL", mf: "Anvil Aerospace", role: "Light Fighter", cls: "combat", crew: 1, size: 1 },
};

// ---- demo roster ------------------------------------------------------
const roster = [
  { id: "m_demo_01", name: "Ironhart", role: "Fleet Admiral", ship: "hammerhead" },
  { id: "m_demo_02", name: "Vesper", role: "Wing Commander", ship: "carrack" },
  { id: "m_demo_03", name: "Kestrel", role: "Combat Lead", ship: "gladius" },
  { id: "m_demo_04", name: "Mara", role: "Cargo Chief", ship: "caterpillar" },
  { id: "m_demo_05", name: "Doc Pemberton", role: "Chief Medic", ship: "apollo" },
  { id: "m_demo_06", name: "Slate", role: "Salvage Lead", ship: "reclaimer" },
  { id: "m_demo_07", name: "Juno", role: "Mining Foreman", ship: "mole" },
  { id: "m_demo_08", name: "Rell", role: "Scout", ship: "arrow" },
  { id: "m_demo_09", name: "Ada", role: "Quartermaster", ship: "connie" },
  { id: "m_demo_10", name: "Bishop", role: "Recon", ship: "six00i" },
  { id: "m_demo_11", name: "Vance", role: "Escort Pilot", ship: "cutlass" },
  { id: "m_demo_12", name: "Sable", role: "Gunner", crewOf: "m_demo_01", seat: 1 },
  { id: "m_demo_13", name: "Pike", role: "Engineer", crewOf: "m_demo_01", seat: 3 },
  { id: "m_demo_14", name: "Echo", role: "Turret Op", crewOf: "m_demo_02", seat: 2 },
  { id: "m_demo_15", name: "Wren", role: "Loadmaster", crewOf: "m_demo_04", seat: 1 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const send = (ws, msg) => ws.send(JSON.stringify(msg));

let latest = null;
const sockets = {};

function connect(memberId, extra = {}) {
  const params = new URLSearchParams({ m: memberId, ...extra });
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${HOST}/parties/fleet/${CODE}?${params}`);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.t === "state") latest = msg.state;
      else if (msg.t === "error") console.warn(`  ! ${memberId}: ${msg.message}`);
    };
    ws.onopen = () => resolve(ws);
    ws.onerror = () => reject(new Error(`socket error for ${memberId}`));
  });
}

function waitFor(label, pred, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (latest && pred(latest)) {
        clearInterval(iv);
        resolve();
      } else if (Date.now() - t0 > timeout) {
        clearInterval(iv);
        reject(new Error(`timed out waiting for: ${label}`));
      }
    }, 120);
  });
}

/** Best-effort ship images from the SC Wiki API. */
async function fetchImages() {
  const map = {};
  try {
    for (let page = 1; page <= 12; page++) {
      const res = await fetch(
        `https://api.star-citizen.wiki/api/vehicles?page[number]=${page}&page[size]=100`,
        { headers: { Accept: "application/json" } },
      );
      if (!res.ok) break;
      const json = await res.json();
      for (const v of json.data ?? []) {
        const img = v.images?.[0]?.thumbnail_url || v.images?.[0]?.original_url;
        if (v.name && img) map[v.name.toLowerCase()] = img;
      }
      if (page >= (json.meta?.last_page ?? 1)) break;
    }
  } catch (e) {
    console.warn("  ship images unavailable:", e.message);
  }
  return map;
}

function shipData(key, images) {
  const s = ships[key];
  return {
    uuid: `demo-${key}`,
    name: s.name,
    gameName: `${s.mfc} ${s.name}`,
    manufacturer: s.mf,
    manufacturerCode: s.mfc,
    role: s.role,
    classification: s.cls,
    crew: s.crew,
    size: s.size,
    image: images[s.name.toLowerCase()] ?? null,
  };
}

async function main() {
  console.log(`Seeding "${CODE}" on ${HOST}…`);
  const images = await fetchImages();
  console.log(`  matched ${Object.keys(images).length} ship images`);

  // 1. Creator opens the fleet.
  const [creator, ...rest] = roster;
  sockets[creator.id] = await connect(creator.id, {
    create: FLEET_NAME,
    name: creator.name,
  });
  await waitFor("fleet created", (s) => s.fleet?.code === CODE);

  // 2. Everyone else connects and joins.
  for (const m of rest) {
    sockets[m.id] = await connect(m.id);
    send(sockets[m.id], { t: "join", display_name: m.name });
    await sleep(60);
  }
  await waitFor("all members", (s) => s.members.length === roster.length);
  console.log(`  ${roster.length} members joined`);

  // 3. Owners pick ships.
  const owners = roster.filter((m) => m.ship);
  for (const m of owners) {
    send(sockets[m.id], { t: "pickShip", ship: shipData(m.ship, images) });
    await sleep(80);
  }
  const totalSlots = owners.reduce((n, m) => n + ships[m.ship].crew, 0);
  await waitFor(
    "all ships",
    (s) =>
      Object.keys(s.assignments).length === owners.length &&
      s.slots.length === totalSlots,
  );
  console.log(`  ${owners.length} ships, ${totalSlots} crew seats`);

  // 4. Crew members claim a seat on someone else's ship.
  const crew = roster.filter((m) => m.crewOf);
  for (const m of crew) {
    const slot = latest.slots.find(
      (s) => s.ship_member_id === m.crewOf && s.position === m.seat,
    );
    if (slot) {
      send(sockets[m.id], { t: "claimSlot", slot_id: slot.id });
      await sleep(80);
    }
  }
  console.log(`  ${crew.length} crew claimed seats`);

  // 5. Everyone sets their fleet role.
  for (const m of roster) {
    send(sockets[m.id], { t: "setRole", member_id: m.id, role: m.role });
    await sleep(50);
  }
  console.log("  roles set");

  await sleep(1200); // let the room persist
  for (const ws of Object.values(sockets)) ws.close();
  await sleep(300);

  console.log(`\nDone. Demo fleet ready at /fleet/${CODE}`);
}

main().catch((e) => {
  console.error("Seed failed:", e.message ?? e);
  for (const ws of Object.values(sockets)) {
    try {
      ws.close();
    } catch {
      /* ignore */
    }
  }
  process.exit(1);
});
