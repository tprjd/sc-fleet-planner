import type { Ship } from "@/types";
import { FALLBACK_SHIPS } from "./fallbackShips";

const BASE_URL = "https://api.star-citizen.wiki/api/vehicles";
const PAGE_SIZE = 75;
const MAX_PAGES = 20; // safety cap (~700 ships / 75 ≈ 10 pages)

/** Raw shape of a vehicle entry from the wiki API (loosely typed). */
type RawVehicle = {
  uuid?: string;
  name?: string;
  game_name?: string;
  role?: string | null;
  classification?: string | null;
  size_class?: number | null;
  is_spaceship?: boolean;
  is_vehicle?: boolean;
  type?: { en_EN?: string } | null;
  manufacturer?: { name?: string; code?: string } | null;
  crew?: {
    min?: number | null;
    max?: number | null;
    weapon?: number | null;
    operation?: number | null;
  } | null;
  images?: Array<{ thumbnail_url?: string; original_url?: string }> | null;
};

type ApiPage = {
  data?: RawVehicle[];
  meta?: { last_page?: number };
};

/** Map one raw API vehicle to our normalized Ship, or null to drop it. */
export function normalizeVehicle(v: RawVehicle): Ship | null {
  if (!v.uuid || !v.name) return null;
  // Drop entries that are neither spaceship nor ground vehicle.
  if (v.is_spaceship === false && v.is_vehicle === false) return null;

  const role =
    v.role || v.type?.en_EN || v.classification || "Unclassified";
  // The wiki splits crew into operators (max/min), weapon gunners, and
  // ops crew. Sum them so multicrew ships get a realistic seat count.
  const crew = Math.max(
    1,
    (v.crew?.max ?? v.crew?.min ?? 1) +
      (v.crew?.weapon ?? 0) +
      (v.crew?.operation ?? 0),
  );

  return {
    uuid: v.uuid,
    name: v.name,
    gameName: v.game_name || v.name,
    manufacturer: v.manufacturer?.name || "Unknown",
    manufacturerCode: v.manufacturer?.code || "—",
    role,
    classification: (v.classification || "other").toLowerCase(),
    crew,
    size: v.size_class ?? 1,
    image: v.images?.[0]?.thumbnail_url || v.images?.[0]?.original_url || null,
  };
}

async function fetchPage(page: number): Promise<ApiPage> {
  const url = `${BASE_URL}?page[number]=${page}&page[size]=${PAGE_SIZE}&include=manufacturer`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Ship API page ${page} failed: ${res.status}`);
  return (await res.json()) as ApiPage;
}

/**
 * Fetch every vehicle page, normalize, dedupe, and sort.
 * Throws if the first page fails — callers fall back to FALLBACK_SHIPS.
 */
export async function fetchAllShips(): Promise<Ship[]> {
  const first = await fetchPage(1);
  const lastPage = Math.min(first.meta?.last_page ?? 1, MAX_PAGES);

  const rest = await Promise.all(
    Array.from({ length: lastPage - 1 }, (_, i) =>
      fetchPage(i + 2).catch(() => ({ data: [] }) as ApiPage),
    ),
  );

  const raw = [first, ...rest].flatMap((p) => p.data ?? []);
  const byUuid = new Map<string, Ship>();
  for (const v of raw) {
    const ship = normalizeVehicle(v);
    if (ship) byUuid.set(ship.uuid, ship);
  }

  const ships = [...byUuid.values()];
  ships.sort((a, b) => a.name.localeCompare(b.name));
  return ships.length > 0 ? ships : FALLBACK_SHIPS;
}
