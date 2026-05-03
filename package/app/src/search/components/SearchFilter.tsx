import { Button } from "@rezics/ui/shadcn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rezics/ui/shadcn";
import type { SortControlsProps } from "@rezics/ui/composite/pagination/Pagination.tsx";
import {
  ArrowDown as ArrowDownward,
  ChevronDown as ArrowDropDownIcon,
  ArrowUp as ArrowUpward,
} from "lucide-react";
import type React from "react";
import { useTranslation } from "react-i18next";

export type BookLibSortKey =
  | "relevance"
  | "time"
  | "favorites"
  | "wordCount"
  | "monthVotes"
  | "recommend";

const LABEL_KEYS: Partial<Record<BookLibSortKey, string>> = {
  relevance: "search.filter.relevance",
  time: "search.filter.time",
  favorites: "search.filter.favorites",
  wordCount: "search.filter.word_count",
  monthVotes: "search.filter.month_votes",
};

export type BookSearchFilterProps = SortControlsProps;

export const BookSearchFilter: React.FC<BookSearchFilterProps> = ({
  sortType,
  sortOrder,
  onSortChange,
}) => {
  const { t } = useTranslation();

  const handleSecondaryMenuSelect = (key: string) => () => {
    console.log(key);
  };

  return (
    <div className="flex justify-between">
      <div className="book-search-filter mb-8 flex flex-row items-center gap-4">
        {(Object.keys(LABEL_KEYS) as BookLibSortKey[]).map((key) => {
          const active = key === sortType;
          return (
            <Button
              key={key}
              variant={active ? "secondary" : "ghost"}
              onClick={() => onSortChange({ type: key })}
            >
              <span className="text-sm">
                {t(LABEL_KEYS[key]! as any)}
              </span>
            </Button>
          );
        })}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost">
              <span className="text-sm">
                {t("search.filter.recommendation")}
              </span>
              <ArrowDropDownIcon className="ml-1" size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={handleSecondaryMenuSelect("weekVotes")}>
              {t("search.filter.week_votes")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSecondaryMenuSelect("monthVotes")}>
              {t("search.filter.month_votes")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSecondaryMenuSelect("totalVotes")}>
              {t("search.filter.total_votes")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div>
        <Button
          variant={sortOrder === "desc" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onSortChange({ order: "desc" })}
          className="normal-case"
        >
          <ArrowDownward />
          &nbsp; {t("search.filter.desc")}
        </Button>
        <Button
          variant={sortOrder === "asc" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onSortChange({ order: "asc" })}
          className="ml-2 normal-case"
        >
          <ArrowUpward />
          &nbsp; {t("search.filter.asc")}
        </Button>
      </div>
    </div>
  );
};
