import type {
  ZoneDynamicTags,
  ZonePageSection,
  ZoneStageChildSection,
} from "@rezics/contract";

export type ZoneDynamicTagSelection = {
  sectionId: string;
  tagUnitIds: string[];
};

export type ZoneDynamicTagSelectionMap = Record<string, string[]>;

type Candidate = {
  key: string;
  tagUnitIds: string[];
  probability: number;
};

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function random01(seed: string): number {
  return hashString(seed) / 0x100000000;
}

export function normalizeDynamicTagUnitIds(tagUnitIds: readonly string[]) {
  return [...tagUnitIds].sort().join("|");
}

function dynamicTagCandidates(dynamicTags: ZoneDynamicTags): Candidate[] {
  const candidates = dynamicTags.options
    .filter((option) => option.probability > 0)
    .map((option) => ({
      key: normalizeDynamicTagUnitIds(option.tagUnitIds),
      tagUnitIds: [...option.tagUnitIds],
      probability: option.probability,
    }));
  if (dynamicTags.fallback) {
    const total = dynamicTags.options.reduce(
      (sum, option) => sum + option.probability,
      0,
    );
    const fallbackProbability = Math.max(0, 1 - total);
    if (fallbackProbability > 0) {
      candidates.push({
        key: "",
        tagUnitIds: [],
        probability: fallbackProbability,
      });
    }
  }
  return candidates;
}

function weightedPick(candidates: readonly Candidate[], seed: string) {
  const total = candidates.reduce(
    (sum, candidate) => sum + candidate.probability,
    0,
  );
  if (total <= 0) return null;
  const target = random01(seed) * total;
  let cursor = 0;
  for (const candidate of candidates) {
    cursor += candidate.probability;
    if (target < cursor) return candidate;
  }
  return candidates[candidates.length - 1] ?? null;
}

function* orderedQuerySections(
  sections: readonly (ZonePageSection | ZoneStageChildSection)[],
  parentPath = "",
): Generator<{
  section: Extract<ZoneStageChildSection, { kind: "query" }>;
  path: string;
}> {
  for (const [index, section] of sections.entries()) {
    const path = parentPath ? `${parentPath}.${index}` : String(index);
    if (section.kind === "query") {
      yield { section, path };
    } else if (section.kind === "stage") {
      yield* orderedQuerySections(section.sections, `${path}.stage`);
    } else if (section.kind === "tabs") {
      for (const [tabIndex, tab] of section.tabs.entries()) {
        yield* orderedQuerySections(tab.sections, `${path}.tabs.${tabIndex}`);
      }
    } else if (section.kind === "columns") {
      for (const [columnIndex, column] of section.columns.entries()) {
        yield* orderedQuerySections(
          column.sections,
          `${path}.columns.${columnIndex}`,
        );
      }
    }
  }
}

/**
 * Selects dynamic tag options before section data loads. Selection is ordered
 * by page config position, not async request completion, so sections sharing a
 * group id see a stable non-repeating pool for the whole page visit.
 */
export function selectZoneDynamicTags(
  sections: readonly ZonePageSection[],
  seed: string,
): ZoneDynamicTagSelectionMap {
  const usedByGroup = new Map<string, Set<string>>();
  const selections: ZoneDynamicTagSelectionMap = {};

  for (const { section, path } of orderedQuerySections(sections)) {
    const dynamicTags = section.dynamicTags;
    if (!dynamicTags || section.query.target !== "unit") continue;

    const candidates = dynamicTagCandidates(dynamicTags);
    if (candidates.length === 0) continue;

    const groupId = dynamicTags.groupId?.trim();
    const used = groupId
      ? (usedByGroup.get(groupId) ?? new Set<string>())
      : null;
    const available =
      used && used.size < candidates.length
        ? candidates.filter((candidate) => !used.has(candidate.key))
        : candidates;
    const picked = weightedPick(available, `${seed}:${path}:${section.id}`);
    if (!picked) continue;

    selections[section.id] = picked.tagUnitIds;
    if (groupId) {
      used?.add(picked.key);
      usedByGroup.set(groupId, used ?? new Set([picked.key]));
    }
  }

  return selections;
}
