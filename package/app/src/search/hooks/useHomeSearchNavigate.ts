import { useNavigate } from "@tanstack/react-router";
import { buildSearchPath } from "../util/searchQuery";

export function useHomeSearchNavigate() {
  const navigate = useNavigate();

  return {
    navigateByKeyword: (keyword: string) => {
      navigate({ to: buildSearchPath({ keyword }) });
    },
    navigateBySearchInfo: (value: {
      keyword?: string;
      tags?: string[];
      tagIds?: string[];
      type?: string | string[];
      realmId?: string;
      nsfw?: boolean;
      isLicensed?: boolean;
    }) => {
      navigate({ to: buildSearchPath(value) });
    },
  };
}
