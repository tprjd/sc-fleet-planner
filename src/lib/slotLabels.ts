/**
 * Given a ship's role and crew count, return labeled crew slots.
 * Slot 0 is always 'Pilot'.
 */
export function defaultSlotLabels(role: string, crew: number): string[] {
  const r = role.toLowerCase();
  const labels = ["Pilot"];
  const rest = r.includes("cargo")
    ? ["Loadmaster", "Engineer", "Security", "Security"]
    : r.includes("mining")
      ? ["Mining Op", "Refinery", "Engineer", "Security"]
      : r.includes("medical")
        ? ["Medic", "Medic", "Engineer", "Security"]
        : r.includes("salv")
          ? ["Salvage Op", "Engineer", "Loadmaster", "Security"]
          : r.includes("explor")
            ? ["Co-Pilot", "Scanner", "Engineer", "Crew"]
            : /capital|frigate|destroyer/.test(r)
              ? ["Engineer", "Gunner", "Gunner", "Gunner", "Marine", "Marine"]
              : ["Co-Pilot", "Gunner", "Turret", "Engineer", "Crew"];

  while (labels.length < crew) {
    labels.push(rest[labels.length - 1] ?? `Crew ${labels.length}`);
  }
  return labels.slice(0, Math.max(1, crew));
}
