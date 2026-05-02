import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { getDefaultRealmId } from "@rezics/api/infra/bootstrap";
import { scoreQueries } from "@rezics/api/score/score";
import { useQuery } from "@tanstack/react-query";
import type React from "react";

interface ScoreOverviewProps {
  unitId: string;
  realm?: string;
}

export const ScoreOverview: React.FC<ScoreOverviewProps> = ({
  unitId,
  realm = getDefaultRealmId() ?? "default",
}) => {
  const { data: aggregates } = useQuery(scoreQueries.aggregates(unitId));

  const aggregate =
    aggregates?.find((a) => a.realm === realm) ?? aggregates?.[0];

  if (!aggregate) {
    return (
      <Typography variant="body2" color="text.secondary">
        No ratings yet
      </Typography>
    );
  }

  const average =
    aggregate.totalCount > 0 ? aggregate.totalScore / aggregate.totalCount : 0;
  const distribution = aggregate.distribution ?? {};
  const maxCount = Math.max(...Object.values(distribution).map(Number), 1);
  const averageVar =
    average >= 5
      ? "var(--rezics-color-sentiment-positive-text)"
      : "var(--rezics-color-sentiment-negative-text)";

  return (
    <Stack direction="row" spacing={3} alignItems="center">
      <Box textAlign="center" minWidth={80}>
        <Typography
          variant="h3"
          fontWeight={700}
          lineHeight={1}
          sx={{ color: averageVar }}
        >
          {average.toFixed(1)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {aggregate.totalCount} ratings
        </Typography>
      </Box>

      <Stack spacing={0.25} flex={1}>
        {Array.from({ length: 10 }, (_, i) => 10 - i).map((score) => {
          const count = Number(distribution[String(score)] ?? 0);
          const percent = (count / maxCount) * 100;
          const barVar =
            score >= 5
              ? "var(--rezics-color-sentiment-positive-fill)"
              : "var(--rezics-color-sentiment-negative-fill)";
          return (
            <Stack key={score} direction="row" spacing={1} alignItems="center">
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ width: 16, textAlign: "right" }}
              >
                {score}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={percent}
                sx={{
                  flex: 1,
                  height: 6,
                  borderRadius: 3,
                  bgcolor: "action.hover",
                  "& .MuiLinearProgress-bar": {
                    bgcolor: barVar,
                  },
                }}
              />
            </Stack>
          );
        })}
      </Stack>
    </Stack>
  );
};
