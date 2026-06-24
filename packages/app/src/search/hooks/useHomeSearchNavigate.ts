import type { SearchQuery } from "@rezics/contract";
import { useNavigate } from "@tanstack/react-router";
import { buildSearchPath } from "../utils/searchQuery";

export function useHomeSearchNavigate() {
  const navigate = useNavigate();

  return {
    navigateByKeyword: (keyword: string) => {
      navigate({ to: buildSearchPath({ keyword }) });
    },
    navigateByQuery: (query: SearchQuery) => {
      navigate({ to: buildSearchPath(query) });
    },
  };
}
