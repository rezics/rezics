import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { postQueries } from "@rezics/api/post/post";
import { PostKind } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { RemarkCard } from "./RemarkCard";

interface RemarkListProps {
  targetUnitId: string;
  limit?: number;
}

export const RemarkList: React.FC<RemarkListProps> = ({
  targetUnitId,
  limit = 20,
}) => {
  const { data, isLoading } = useQuery(
    postQueries.byTarget(targetUnitId),
  );

  const remarks =
    data?.posts?.filter((p) => p.kind === PostKind.REMARK) ?? [];

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={3}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  if (remarks.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" py={2}>
        No remarks yet. Be the first to share your thoughts!
      </Typography>
    );
  }

  return (
    <Box>
      {remarks.slice(0, limit).map((remark) => (
        <RemarkCard key={remark.unitId} remark={remark} />
      ))}
    </Box>
  );
};
