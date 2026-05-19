# Star Citizen Fleet Planner

A real-time web app where players create or join a fleet via a short code,
pick their ship from the Star Citizen Wiki API, configure crew slots, and let
teammates claim seats. State syncs live across every browser in the fleet.

**Frontend:** Vite + React + TypeScript, Tailwind CSS v4, TanStack Query.
**Backend:** Cloudflare Workers + Durable Objects — one Durable Object per
fleet code, holding that fleet's state and broadcasting it over WebSockets
([partyserver](https://github.com/cloudflare/partyserver) / partysocket).

---

## Features

- **Real-time, no accounts.** Every client in a fleet holds a WebSocket to
  the same Durable Object; state syncs instantly. Pilots are identified by a
  `memberId` stored in `localStorage` and a unique callsign per fleet.
- **Ship picker from the SC Wiki API** with search and classification
  filters, cached client-side, with a bundled fallback when the API is down.
- **Crew seats per ship** — role-based defaults per ship type; claim, vacate,
  rename, add, or remove seats. One seat per pilot fleet-wide, enforced
  atomically.
- **Open ships.** The fleet creator can preemptively add ships with no
  owner; anyone fills any seat, pilot included.
- **Per-pilot fleet role** — free-text label like *Wing Commander* or
  *Logistics Lead*.
- **Card and Table views**, both with compact modes; hide empty seats with a
  one-click "claim first free seat" shortcut.
- **Live presence** — online dot on each pilot's avatar plus *"last seen
  5m ago"*, derived from connections (no heartbeat).
- **Owner controls** — lock the fleet, set a member limit, kick members,
  manage anyone's ship, pin an announcement at the top of chat.
- **Parked-ship crewing** — claiming a seat on another ship hides your own
  card; a banner brings you back with one click.
- **Fleet chat** — collapsible sidebar with auto-linked URLs and an
  owner-pinned banner. Messages are ephemeral: the room holds a ~50-line
  in-memory buffer that resets on Durable Object hibernation.

## Quick start

```bash
npm install
cp .env.example .env          # VITE_WORKER_HOST defaults to localhost:8787

npm run worker:dev            # terminal 1 — the Cloudflare Worker (localhost:8787)
npm run dev                   # terminal 2 — the Vite frontend (localhost:5173)
```

No accounts, no database to provision — a fleet exists as soon as someone
creates it, and lives in its Durable Object.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server (frontend) |
| `npm run build` | Type-check + production build of the frontend |
| `npm run worker:dev` | Run the Worker locally with `wrangler dev` |
| `npm run worker:deploy` | Deploy the Worker to Cloudflare |
| `npm run worker:check` | Type-check the Worker |

## Deploying

**1. The Worker (Cloudflare)**

```bash
npx wrangler login        # once
npm run worker:deploy
```

First time only: if the deploy errors about a missing `workers.dev` subdomain,
open **Workers & Pages** in the Cloudflare dashboard once (that provisions it),
then re-run. The deploy prints the Worker URL, e.g.
`https://sc-fleet-planner.<subdomain>.workers.dev`.

**2. The frontend (Vercel, or any static host)**

`VITE_WORKER_HOST` must be baked into the build so the app knows which Worker
to reach. Either set it as a project environment variable in the Vercel
dashboard and run `vercel --prod`, or pass it inline:

```bash
vercel --prod --build-env VITE_WORKER_HOST=sc-fleet-planner.<subdomain>.workers.dev
```

(Use the host with no protocol.) The app is a static SPA; `vercel.json`
rewrites every route to `index.html` so deep links like `/fleet/ABC234` work.

## Demo fleet

```bash
node scripts/seed-demo.mjs [wss://worker-host]
```

Populates an `ARMADA` demo fleet — 15 pilots, 11 ships, crew rosters and roles —
by replaying WebSocket actions against the Worker (defaults to production).
Reachable afterward at `/fleet/ARMADA`.

## How it works

- **One Durable Object per fleet.** Every client viewing fleet `ABC234` holds
  a WebSocket to that fleet's DO. The DO owns the state, applies each mutation
  (a DO processes messages serially, so seat claims are race-free), persists to
  its storage, and broadcasts the full snapshot to every connected client.
- **Presence is free.** Online status is derived from live connections — no
  heartbeat. A pilot's last-seen time is recorded when their last socket closes.
- **Identity** — each browser generates a `memberId` stored in `localStorage`;
  there are no accounts. On first join the room mints a per-fleet **session
  token** and returns it to the client, which stores it alongside the
  `memberId`; every subsequent (re)connection must present it, so a leaked
  `memberId` alone can't impersonate.
- **Idle fleets are reclaimed.** A Durable Object alarm purges fleets with
  no connections and no mutations for 30 days. Active rooms reschedule
  themselves on every connection or change.
- **Ships** — the vehicle list is fetched once from `api.star-citizen.wiki`,
  normalized, and cached 24h client-side. A bundled fallback keeps the picker
  working if the API is down.

The client ↔ room message protocol and shared types live in
[`shared/protocol.ts`](shared/protocol.ts).

## Project structure

```
src/           React frontend
  hooks/useFleet.ts    WebSocket connection to a fleet room
  components/          UI
  lib/                 identity, codes, ship API, slot labels
worker/
  index.ts             the Worker + FleetRoom Durable Object
shared/
  protocol.ts          domain types + client/server message protocol
wrangler.jsonc         Cloudflare Worker config (DO binding + migration)
```
