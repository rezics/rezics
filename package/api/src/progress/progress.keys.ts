import type {
  ContinueReadingListQuery,
  UnitProgressListQuery,
} from "@rezics/contract";

export const progressKeys = {
  all: () => ["progress"] as const,
  unit: (unitId: string) => [...progressKeys.all(), "unit", unitId] as const,
  unitPosts: (unitId: string) =>
    [...progressKeys.unit(unitId), "posts"] as const,
  stats: (unitId: string) => [...progressKeys.all(), "stats", unitId] as const,
  lists: () => [...progressKeys.all(), "list"] as const,
  list: (query?: UnitProgressListQuery) =>
    [...progressKeys.lists(), query ?? {}] as const,
  continueReadingLists: () =>
    [...progressKeys.all(), "continue-reading"] as const,
  continueReadingList: (query?: ContinueReadingListQuery) =>
    [...progressKeys.continueReadingLists(), query ?? {}] as const,
  libraryLists: () => [...progressKeys.all(), "library"] as const,
  libraryList: (query?: UnitProgressListQuery) =>
    [...progressKeys.libraryLists(), query ?? {}] as const,
  pageLists: () => [...progressKeys.all(), "page"] as const,
  pageList: (query?: UnitProgressListQuery) =>
    [...progressKeys.pageLists(), query ?? {}] as const,
} as const;
