import { create } from "zustand";
import type { SearchInfo } from "../model/searchInfo";
import { normalizeSearchInfo } from "../model/searchInfo";

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
  query: SearchInfo;
  filter: SearchFilterState;
  status: SearchRequestStatus;
  result: SearchResultState;
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

export const useSearchState = create<SearchState>()((set) => ({
  query: initialQuery,
  filter: { sortOrder: "desc" },
  status: "idle",
  result: { items: [], total: 0 },
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
      query: initialQuery,
      filter: { sortOrder: "desc" },
      status: "idle",
      result: { items: [], total: 0 },
    }),
}));
