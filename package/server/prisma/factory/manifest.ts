import type { UnitType } from "../generated/client.js";
import type { SeedManifestEntry, SeedResult, SeedSyncTarget } from "./types.js";

interface ManifestEntryInput {
  label: string;
  scenario?: string;
  unitType: UnitType;
  unitId: string;
  syncTargets: SeedSyncTarget[];
  notes?: string;
}

function keyFor(
  entry: Pick<SeedManifestEntry, "scenario" | "label" | "unitId">,
) {
  return `${entry.scenario ?? "base"}:${entry.label}:${entry.unitId}`;
}

export function createSeedResult(): SeedResult {
  return { manifest: [] };
}

export function addSeedManifestEntry(
  result: SeedResult,
  input: ManifestEntryInput,
): SeedManifestEntry {
  const syncTargets = [...new Set(input.syncTargets)];
  const key = keyFor(input);
  const existing = result.manifest.find((entry) => keyFor(entry) === key);
  if (existing) {
    existing.syncTargets = [
      ...new Set([...existing.syncTargets, ...syncTargets]),
    ];
    if (input.notes && !existing.notes) existing.notes = input.notes;
    return existing;
  }

  const entry: SeedManifestEntry = {
    ...input,
    syncTargets,
  };
  result.manifest.push(entry);
  return entry;
}

export function mergeSeedResults(
  target: SeedResult,
  source: SeedResult,
): SeedResult {
  for (const entry of source.manifest) {
    addSeedManifestEntry(target, entry);
  }
  return target;
}
