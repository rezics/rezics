import type { SearchQuery } from "@rezics/contract";
import { create } from "zustand";
import type { SearchInfo } from "../models/searchInfo";
import { normalizeSearchInfo } from "../models/searchInfo";

export type SearchRequestStatus = "idle" | "loading" | "success" | "error";

type SearchFilterState = {
  sortType?: string;
  sortOrder?: "asc" | "desc";
};

type SearchResultState<T = unknown> = {
  items: T[];
  total: number;
  error?: string;
};

type SearchState = {
  /** Structured search query (new) */
  searchQuery: SearchQuery;
  /** Legacy SearchInfo — kept for backward compat with existing components */
  query: SearchInfo;
  filter: SearchFilterState;
  status: SearchRequestStatus;
  result: SearchResultState;
  setSearchQuery: (value: SearchQuery) => void;
  setQuery: (value: SearchInfo) => void;
  setFilter: (value: Partial<SearchFilterState>) => void;
  setStatus: (value: SearchRequestStatus) => void;
  setResult: <T>(value: SearchResultState<T>) => void;
  reset: () => void;
};

const initialQuery: SearchInfo = {
  keyword: "",
  tags: [],
  tagIds: [],
  nsfw: false,
  isLicensed: false,
};

const initialSearchQuery: SearchQuery = {};

export const useSearchState = create<SearchState>()((set) => ({
  searchQuery: initialSearchQuery,
  query: initialQuery,
  filter: { sortOrder: "desc" },
  status: "idle",
  result: { items: [], total: 0 },
  setSearchQuery: (value) => set({ searchQuery: value }),
  setQuery: (value) => set({ query: normalizeSearchInfo(value) }),
  setFilter: (value) =>
    set((state) => ({
      filter: {
        ...state.filter,
        ...value,
      },
    })),
  setStatus: (value) => set({ status: value }),
  setResult: (value) => set({ result: value }),
  reset: () =>
    set({
      searchQuery: initialSearchQuery,
      query: initialQuery,
      filter: { sortOrder: "desc" },
      status: "idle",
      result: { items: [], total: 0 },
    }),
}));
