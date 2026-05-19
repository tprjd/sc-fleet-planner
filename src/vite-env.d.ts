/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Host of the Cloudflare Worker, e.g. "localhost:8787" or
   *  "sc-fleet-planner.<subdomain>.workers.dev" (no protocol). */
  readonly VITE_WORKER_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
