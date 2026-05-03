import { Typography } from "@mui/material";
import type {
  ContentSearchDocument,
  ContentSearchResult,
} from "@rezics/contract";
import { EmptyState } from "@rezics/ui";
import type React from "react";
import { useTranslation } from "react-i18next";

function resolveTitle(
  titles: string[],
  languages: string[],
  preferredLanguage?: string,
): string {
  if (!titles.length) return "";
  if (preferredLanguage) {
    const idx = languages.indexOf(preferredLanguage);
    if (idx >= 0 && titles[idx]) return titles[idx];
  }
  return titles[0] ?? "";
}

export type SearchResultListProps = {
  result?: ContentSearchResult;
  isLoading?: boolean;
  preferredLanguage?: string;
  renderItem?: (item: ContentSearchDocument) => React.ReactNode;
};

const DefaultResultItem: React.FC<{
  item: ContentSearchDocument;
  preferredLanguage?: string;
}> = ({ item, preferredLanguage }) => {
  const title = resolveTitle(item.titles, item.languages, preferredLanguage);

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      {item.coverUrl && (
        <img
          src={item.coverUrl}
          alt={title}
          className="w-24 h-32 object-cover rounded"
        />
      )}
      <div className="flex-1 min-w-0">
        <Typography variant="subtitle2" noWrap>
          {title || item.id}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {item.type}
        </Typography>
        {item.summaries[0] && (
          <Typography
            variant="body2"
            color="text.secondary"
            className="line-clamp-2 mt-1"
          >
            {item.summaries[0]}
          </Typography>
        )}
      </div>
    </div>
  );
};

export const SearchResultList: React.FC<SearchResultListProps> = ({
  result,
  isLoading,
  preferredLanguage,
  renderItem,
}) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="py-12 text-center">
        <Typography color="text.secondary">{t("common.loading")}</Typography>
      </div>
    );
  }

  if (!result || result.items.length === 0) {
    return <EmptyState title={t("search.empty.title")} />;
  }

  return (
    <div>
      <Typography
        variant="caption"
        color="text.secondary"
        className="mb-2 block"
      >
        {result.total} results ({result.processingTimeMs}ms)
      </Typography>
      <div>
        {result.items.map((item) =>
          renderItem ? (
            <div key={item.id}>{renderItem(item)}</div>
          ) : (
            <DefaultResultItem
              key={item.id}
              item={item}
              preferredLanguage={preferredLanguage}
            />
          ),
        )}
      </div>
    </div>
  );
};
