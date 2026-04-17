import { Chip, Stack, Typography } from "@mui/material";
import { bookQueries } from "@rezics/api/book/book";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import type React from "react";
import { getTranslation } from "@/shared/utils/translation-helpers";

interface WorkReleaseNavProps {
  workUnitId?: string | null;
  currentBookId: string;
}

export const WorkReleaseNav: React.FC<WorkReleaseNavProps> = ({
  workUnitId,
  currentBookId,
}) => {
  const { data } = useQuery({
    ...bookQueries.list({
      workUnitId: workUnitId ?? undefined,
      limit: 10,
    }),
    enabled: !!workUnitId,
  });

  const releases =
    data?.books?.filter((b) => b.unitId !== currentBookId) ?? [];

  if (releases.length === 0) return null;

  return (
    <div>
      <Typography variant="subtitle2" fontWeight={600} mb={1}>
        Other Editions
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {releases.map((book) => (
          <Link
            key={book.unitId}
            to="/book/$bookId"
            params={{ bookId: book.unitId }}
          >
            <Chip
              label={
                getTranslation(book.translations)?.title ??
                "Edition"
              }
              size="small"
              variant="outlined"
              clickable
            />
          </Link>
        ))}
      </Stack>
    </div>
  );
};
