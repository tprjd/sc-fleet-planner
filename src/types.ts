// Frontend type surface. Domain + protocol types live in shared/protocol.ts
// (shared with the Cloudflare Worker); this re-exports them for the app.

export * from "../shared/protocol";

import type { ShipData } from "../shared/protocol";

/** The normalized wiki-API ship — identical shape to the stored ShipData. */
export type Ship = ShipData;
