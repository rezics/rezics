import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import { Clock as ClockIcon, X as CloseIcon } from "lucide-react";
import type React from "react";

export interface SearchHistoryProps {
  entries: string[];
  onSelect: (term: string) => void;
  onRemove: (term: string) => void;
  onClear: () => void;
}

/**
 * Recent-search recall surface. Renders nothing when there is no history,
 * so the caller can mount it unconditionally above the result list.
 */
export const SearchHistory: React.FC<SearchHistoryProps> = ({
  entries,
  onSelect,
  onRemove,
  onClear,
}) => {
  const { t } = useTranslation(["search"]);

  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium text-text-secondary">
          <ClockIcon className="h-4 w-4" />
          {t("search:recent_searches_title")}
        </span>
        <Button size="sm" variant="ghost" onClick={onClear}>
          {t("search:recent_searches_clear")}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {entries.map((term) => (
          <span
            key={term}
            className="flex items-center gap-1 rounded-full border border-border-whisper bg-surface-sunken pl-3 pr-1 text-sm"
          >
            <button
              type="button"
              className="py-1 text-text-primary hover:underline"
              onClick={() => onSelect(term)}
            >
              {term}
            </button>
            <button
              type="button"
              className="flex h-5 w-5 items-center justify-center rounded-full text-text-secondary hover:bg-surface-raised hover:text-text-primary"
              aria-label={t("search:recent_searches_remove")}
              onClick={() => onRemove(term)}
            >
              <CloseIcon className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
};
