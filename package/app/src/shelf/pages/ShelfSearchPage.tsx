import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { contentSearchQueryOptions } from "@rezics/api/meili/meili.queries";
import type { ShelfDTO } from "@rezics/contract";
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
    <Box maxWidth="lg" mx="auto" px={2} py={3}>
      <Typography variant="h5" fontWeight={600} mb={3}>
        Search Shelves
      </Typography>

      <Box mb={3}>
        <KeywordInput
          value={keywordBind.value ?? ""}
          onChange={(v) => keywordBind.onChange(v)}
          onSubmit={() => setOffset(0)}
          placeholder="Search shelves..."
        />
      </Box>

      {isLoading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : shelves.length === 0 ? (
        <Typography color="text.secondary" textAlign="center" py={4}>
          No shelves found
        </Typography>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {shelves.map((shelf) => (
            <ShelfCard key={shelf.unitId} shelf={shelf} />
          ))}
        </div>
      )}
    </Box>
  );
}

export default ShelfSearchPage;
