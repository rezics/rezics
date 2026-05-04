import { contentSearchQueryOptions } from "@rezics/api/meili/meili.queries";
import type { ShelfDTO } from "@rezics/contract";
import { Spinner } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { KeywordInput } from "@/search/components/primitive";
import { useSearchQuery } from "@/search/hooks/useSearchQuery";
import { ShelfCard } from "../components/ShelfCard";

export function ShelfSearchPage() {
  const search = useSearchQuery({
    implicitInitial: { type: ["SHELF"] },
  });
  const [offset, setOffset] = useState(0);
  const limit = 20;
  const keywordBind = search.bind("keyword");
  const searchOpts = search.toOptions();

  const { data, isLoading } = useQuery(
    contentSearchQueryOptions({
      ...searchOpts,
      offset,
      limit,
    }),
  );

  const shelves = useMemo<ShelfDTO[]>(
    () => (data?.items ?? []) as unknown as ShelfDTO[],
    [data],
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-semibold">Search Shelves</h1>

      <div className="mb-6">
        <KeywordInput
          value={keywordBind.value ?? ""}
          onChange={(v) => keywordBind.onChange(v)}
          onSubmit={() => setOffset(0)}
          placeholder="Search shelves..."
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : shelves.length === 0 ? (
        <p className="py-8 text-center text-text-secondary">
          No shelves found
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {shelves.map((shelf) => (
            <ShelfCard key={shelf.unitId} shelf={shelf} />
          ))}
        </div>
      )}
    </div>
  );
}

export default ShelfSearchPage;
