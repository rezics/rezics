import type { ShelfDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
import { useMemo, useState } from "react";
import { KeywordInput, useSearchQuery } from "@/search";
import { useLocalizedContentSearch } from "@/shared/hooks/useLocalizedMeiliSearch";
import { ShelfCard } from "../components/ShelfCard";

export function ShelfSearchPage() {
  const { t } = useTranslation(["common", "entity"]);
  const search = useSearchQuery({
    implicitInitial: { type: ["SHELF"] },
  });
  const [offset, setOffset] = useState(0);
  const limit = 20;
  const keywordBind = search.bind("keyword");
  const searchOpts = search.toOptions();

  const { data, isLoading } = useLocalizedContentSearch({
    ...searchOpts,
    offset,
    limit,
  });

  const shelves = useMemo<ShelfDTO[]>(
    () => (data?.items ?? []) as unknown as ShelfDTO[],
    [data],
  );
  const total = data?.total ?? 0;
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasPreviousPage = offset > 0;
  const hasNextPage = offset + limit < total;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-semibold">
        {t("entity:shelf_search_title")}
      </h1>

      <div className="mb-6">
        <KeywordInput
          value={keywordBind.value ?? ""}
          onChange={(v) => keywordBind.onChange(v)}
          onSubmit={() => setOffset(0)}
          placeholder={t("entity:shelf_search_placeholder")}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : shelves.length === 0 ? (
        <p className="py-8 text-center text-text-secondary">
          {t("entity:shelf_none_found")}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {shelves.map((shelf) => (
              <ShelfCard key={shelf.unitId} shelf={shelf} />
            ))}
          </div>
          {(hasPreviousPage || hasNextPage) && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={!hasPreviousPage || isLoading}
                onClick={() => setOffset((value) => Math.max(0, value - limit))}
              >
                {t("common:prev")}
              </Button>
              <span className="text-sm text-text-secondary">
                {currentPage} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={!hasNextPage || isLoading}
                onClick={() => setOffset((value) => value + limit)}
              >
                {t("common:next")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
