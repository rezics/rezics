import type { SeedResult, SpecialSeedTarget } from "./types.js";

export function createSeedResult(): SeedResult {
  return { specialTargets: [] };
}

function specialKeyFor(entry: Pick<SpecialSeedTarget, "scenario" | "unitId">) {
  return `${entry.scenario}:${entry.unitId}`;
}

export function addSpecialSeedTarget(
  result: SeedResult,
  input: SpecialSeedTarget,
): SpecialSeedTarget {
  const existing = result.specialTargets.find(
    (entry) => specialKeyFor(entry) === specialKeyFor(input),
  );
  if (existing) {
    if (input.notes && !existing.notes) existing.notes = input.notes;
    return existing;
  }

  result.specialTargets.push(input);
  return input;
}

export function mergeSeedResults(
  target: SeedResult,
  source: SeedResult,
): SeedResult {
  for (const entry of source.specialTargets) {
    addSpecialSeedTarget(target, entry);
  }
  return target;
}
