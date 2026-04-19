import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { mapUnitListToReviewListResponse } from "@rezics/api/meili/meili.api";
import { buildMeiliUnitQuery } from "@rezics/api/meili/meili.queries";
import { UnitType } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ReviewList } from "@/review/components/list/ReviewList";
import { TextSearchInputWithIcon } from "@/search/components/TextSearchInputWithIcon";

export function ReviewSearchPage() {
  const [keyword, setKeyword] = useState("");
  const [start, setStart] = useState(0);
  const limit = 20;

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
        <TextSearchInputWithIcon
          onSearch={(info) => {
            setKeyword(info ?? "");
            setStart(0);
          }}
          defaultValue={{ keyword }}
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
