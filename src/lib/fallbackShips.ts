import type { Ship } from "@/types";

/**
 * Small bundled ship list used when the Star Citizen Wiki API is
 * unreachable. Not exhaustive — just enough that the app stays usable.
 */
export const FALLBACK_SHIPS: Ship[] = [
  ship("a", "Aurora MR", "RSI", "Roberts Space Industries", "Starter", "starter", 1, 1),
  ship("b", "Mustang Alpha", "CNOU", "Consolidated Outland", "Starter", "starter", 1, 1),
  ship("c", "300i", "ORIG", "Origin Jumpworks", "Touring", "touring", 1, 2),
  ship("d", "100i", "ORIG", "Origin Jumpworks", "Pathfinder", "pathfinder", 1, 1),
  ship("e", "Avenger Titan", "AEGS", "Aegis Dynamics", "Light Freight", "transport", 1, 2),
  ship("f", "Cutlass Black", "DRAK", "Drake Interplanetary", "Multi-Role", "multi", 2, 2),
  ship("g", "Gladius", "AEGS", "Aegis Dynamics", "Light Fighter", "combat", 1, 1),
  ship("h", "Hornet F7C", "ANVL", "Anvil Aerospace", "Medium Fighter", "combat", 1, 2),
  ship("i", "Arrow", "ANVL", "Anvil Aerospace", "Light Fighter", "combat", 1, 1),
  ship("j", "Buccaneer", "DRAK", "Drake Interplanetary", "Light Fighter", "combat", 1, 1),
  ship("k", "Vanguard Warden", "AEGS", "Aegis Dynamics", "Heavy Fighter", "combat", 2, 3),
  ship("l", "Constellation Andromeda", "RSI", "Roberts Space Industries", "Multi-Role", "multi", 4, 3),
  ship("m", "Freelancer", "MISC", "Musashi Industrial", "Cargo", "transport", 4, 3),
  ship("n", "Freelancer MAX", "MISC", "Musashi Industrial", "Cargo", "transport", 2, 3),
  ship("o", "Cutlass Red", "DRAK", "Drake Interplanetary", "Medical", "medical", 3, 2),
  ship("p", "Apollo Triage", "RSI", "Roberts Space Industries", "Medical", "medical", 3, 3),
  ship("q", "Prospector", "MISC", "Musashi Industrial", "Mining", "mining", 1, 2),
  ship("r", "MOLE", "ARGO", "Argo Astronautics", "Mining", "mining", 4, 3),
  ship("s", "Vulture", "DRAK", "Drake Interplanetary", "Salvage", "salvage", 1, 2),
  ship("t", "Reclaimer", "AEGS", "Aegis Dynamics", "Salvage", "salvage", 5, 5),
  ship("u", "Caterpillar", "DRAK", "Drake Interplanetary", "Cargo", "transport", 5, 4),
  ship("v", "Hull C", "MISC", "Musashi Industrial", "Cargo", "transport", 4, 5),
  ship("w", "Carrack", "ANVL", "Anvil Aerospace", "Expedition", "exploration", 6, 4),
  ship("x", "600i Explorer", "ORIG", "Origin Jumpworks", "Exploration", "exploration", 5, 4),
  ship("y", "Constellation Aquila", "RSI", "Roberts Space Industries", "Exploration", "exploration", 5, 3),
  ship("z", "Corsair", "DRAK", "Drake Interplanetary", "Exploration", "exploration", 4, 3),
  ship("aa", "Redeemer", "AEGS", "Aegis Dynamics", "Gunship", "combat", 5, 3),
  ship("ab", "Hammerhead", "AEGS", "Aegis Dynamics", "Patrol Corvette", "combat", 9, 5),
  ship("ac", "Retaliator", "AEGS", "Aegis Dynamics", "Bomber", "combat", 6, 4),
  ship("ad", "890 Jump", "ORIG", "Origin Jumpworks", "Luxury", "transport", 8, 6),
  ship("ae", "Polaris", "RSI", "Roberts Space Industries", "Corvette", "capital", 14, 6),
  ship("af", "Idris-P", "AEGS", "Aegis Dynamics", "Frigate", "capital", 28, 6),
];

function ship(
  uuid: string,
  name: string,
  manufacturerCode: string,
  manufacturer: string,
  role: string,
  classification: string,
  crew: number,
  size: number,
): Ship {
  return {
    uuid: `fallback-${uuid}`,
    name,
    gameName: `${manufacturerCode} ${name}`,
    manufacturer,
    manufacturerCode,
    role,
    classification,
    crew: Math.max(1, crew),
    size,
    image: null,
  };
}
