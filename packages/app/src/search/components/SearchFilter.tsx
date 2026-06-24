import { getI18nRuntime } from "@rezics/i18n/runtime";

const i18nMessages = {
  search_filter_relevance: () =>
    getI18nRuntime().i18n.t("search:filter_relevance"),
  search_filter_time: () => getI18nRuntime().i18n.t("search:filter_time"),
  search_filter_favorites: () =>
    getI18nRuntime().i18n.t("search:filter_favorites"),
  search_filter_word_count: () =>
    getI18nRuntime().i18n.t("search:filter_word_count"),
  search_filter_month_votes: () =>
    getI18nRuntime().i18n.t("search:filter_month_votes"),
} as const;

import { useTranslation } from "@rezics/i18n/react";
import type { SortControlsProps } from "@rezics/ui/composite/pagination/Pagination.tsx";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rezics/ui/shadcn";
import {
  ArrowDown as ArrowDownward,
  ChevronDown as ArrowDropDownIcon,
  ArrowUp as ArrowUpward,
} from "lucide-react";
import type React from "react";

export type BookLibSortKey =
  | "relevance"
  | "time"
  | "favorites"
  | "wordCount"
  | "monthVotes"
  | "recommend";

const FILTER_LABEL = {
  relevance: i18nMessages.search_filter_relevance,
  time: i18nMessages.search_filter_time,
  favorites: i18nMessages.search_filter_favorites,
  wordCount: i18nMessages.search_filter_word_count,
  monthVotes: i18nMessages.search_filter_month_votes,
} as const satisfies Partial<Record<BookLibSortKey, () => string>>;

export type BookSearchFilterProps = SortControlsProps;

export const BookSearchFilter: React.FC<BookSearchFilterProps> = ({
  sortType,
  sortOrder,
  onSortChange,
}) => {
  const { t } = useTranslation(["search"]);
  const handleSecondaryMenuSelect = (key: string) => () => {
    onSortChange({ type: key });
  };

  return (
    <div className="flex justify-between">
      <div className="book-search-filter mb-8 flex flex-row items-center gap-4">
        {(Object.keys(FILTER_LABEL) as Array<keyof typeof FILTER_LABEL>).map(
          (key) => {
            const active = key === sortType;
            return (
              <Button
                key={key}
                variant={active ? "secondary" : "ghost"}
                onClick={() => onSortChange({ type: key })}
              >
                <span className="text-sm">{FILTER_LABEL[key]()}</span>
              </Button>
            );
          },
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            nativeButton
            render={(props) => (
              <Button variant="ghost" {...props}>
                <span className="text-sm">
                  {t("search:filter_recommendation")}
                </span>
                <ArrowDropDownIcon className="ml-1" size={16} />
              </Button>
            )}
          />
          <DropdownMenuContent>
            <DropdownMenuItem onClick={handleSecondaryMenuSelect("weekVotes")}>
              {t("search:filter_week_votes")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSecondaryMenuSelect("monthVotes")}>
              {t("search:filter_month_votes")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSecondaryMenuSelect("totalVotes")}>
              {t("search:filter_total_votes")}
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
          &nbsp; {t("search:filter_desc")}
        </Button>
        <Button
          variant={sortOrder === "asc" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onSortChange({ order: "asc" })}
          className="ml-2 normal-case"
        >
          <ArrowUpward />
          &nbsp; {t("search:filter_asc")}
        </Button>
      </div>
    </div>
  );
};
