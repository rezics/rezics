import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { mapUnitListToReviewListResponse } from "@rezics/api/meili/meili.api";
import { buildMeiliUnitQuery } from "@rezics/api/meili/meili.queries";
import { UnitType } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ReviewList } from "@/review/components/list/ReviewList";
import { KeywordInput } from "@/search/components/primitive";
import { useSearchQuery } from "@/search/hooks/useSearchQuery";

export function ReviewSearchPage() {
  const search = useSearchQuery({});
  const [start, setStart] = useState(0);
  const limit = 20;
  const keyword = search.query.keyword ?? "";
  const keywordBind = search.bind("keyword");

  const { data, isLoading } = useQuery(
    buildMeiliUnitQuery({
      kind: UnitType.POST,
      start,
      targetUnitId: "",
      keyword,
      limit,
      mapFn: mapUnitListToReviewListResponse,
    }),
  );

  const reviews = data?.reviews ?? [];

  return (
    <Box maxWidth="lg" mx="auto" px={2} py={3}>
      <Typography variant="h5" fontWeight={600} mb={3}>
        Search Reviews
      </Typography>

      <Box mb={3}>
        <KeywordInput
          value={keywordBind.value ?? ""}
          onChange={(v) => keywordBind.onChange(v)}
          onSubmit={() => setStart(0)}
          placeholder="Search reviews..."
        />
      </Box>

      {isLoading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : reviews.length === 0 ? (
        <Typography color="text.secondary" textAlign="center" py={4}>
          No reviews found
        </Typography>
      ) : (
        <ReviewList reviews={reviews} />
      )}
    </Box>
  );
}

export default ReviewSearchPage;
