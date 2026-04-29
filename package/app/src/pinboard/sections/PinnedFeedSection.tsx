import { Box, Stack, Typography } from "@mui/material";
import type React from "react";
import { useTranslation } from "react-i18next";
import { PinboardEntryCard } from "../components/PinboardEntryCard";
import { PinboardErrorState } from "../components/PinboardErrorState";
import { PinboardSkeleton } from "../components/PinboardSkeleton";
import { usePinboardList } from "../hooks/usePinboard";

export interface PinnedFeedSectionProps {
  realmUnitId: string;
  /** When provided, used as the link target for each card (e.g. "/post/{unitId}"). */
  linkFor?: (unitId: string) => string;
}

/**
 * Renders the pinned region above a realm feed. No-ops when the list is
 * empty, silent on errors in the feed-adjacent position to avoid crowding
 * the viewport — errors still surface via the skeleton fallback state.
 */
export const PinnedFeedSection: React.FC<PinnedFeedSectionProps> = ({
  realmUnitId,
  linkFor,
}) => {
  const { t } = useTranslation();
  const { entries, isLoading, isError, refetch } = usePinboardList({
    realmUnitId,
    pinboardKey: "pinboard",
  });

  if (isLoading) {
    return (
      <Box mb={2}>
        <PinboardSkeleton rows={2} rowHeight={64} />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box mb={2}>
        <PinboardErrorState onRetry={() => refetch()} />
      </Box>
    );
  }

  if (entries.length === 0) return null;

  return (
    <Box mb={2} component="section" aria-label={t("pinboard.pinned.region")}>
      <Typography variant="overline" color="text.secondary" sx={{ px: 0.5 }}>
        {t("pinboard.pinned.heading")}
      </Typography>
      <Stack spacing={1}>
        {entries.map((entry) => (
          <PinboardEntryCard
            key={entry.unitId}
            entry={entry}
            variant="card"
            href={linkFor?.(entry.unitId)}
          />
        ))}
      </Stack>
    </Box>
  );
};
