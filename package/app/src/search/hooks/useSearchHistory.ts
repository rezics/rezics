import { useState } from "react";
import {
  clearSearchHistory,
  pushSearchHistory,
  readSearchHistory,
  removeSearchHistory,
} from "../models/searchHistory";

export interface UseSearchHistoryReturn {
  entries: string[];
  record: (term: string) => void;
  remove: (term: string) => void;
  clear: () => void;
}

/**
 * React wrapper over the local search-history model. State is seeded from
 * `localStorage` and kept in sync as the user records, removes, or clears
 * terms. Backed entirely by the browser — no server round-trip.
 */
export function useSearchHistory(): UseSearchHistoryReturn {
  const [entries, setEntries] = useState<string[]>(() => readSearchHistory());

  const record = (term: string) => {
    setEntries(pushSearchHistory(term));
  };

  const remove = (term: string) => {
    setEntries(removeSearchHistory(term));
  };

  const clear = () => {
    setEntries(clearSearchHistory());
  };

  return { entries, record, remove, clear };
}
