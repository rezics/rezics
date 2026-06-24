import type {
  UnitExternalLinkListQuery,
  UnitExternalLinksBatchBody,
} from "@rezics/contract";

export const unitExternalLinkKeys = {
  all: () => ["unit-external-link"] as const,
  lists: () => [...unitExternalLinkKeys.all(), "list"] as const,
  list: (query?: UnitExternalLinkListQuery) =>
    [...unitExternalLinkKeys.lists(), query] as const,
  links: (unitId: string, sourceEntityUnitId?: string) =>
    [
      ...unitExternalLinkKeys.all(),
      "links",
      unitId,
      sourceEntityUnitId,
    ] as const,
  linksBatch: (input: UnitExternalLinksBatchBody) =>
    [...unitExternalLinkKeys.all(), "links-batch", input] as const,
} as const;
