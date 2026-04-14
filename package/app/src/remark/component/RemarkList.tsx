import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { usePostSearchQuery } from "@rezics/api/meili/meili.queries";
import type { PostDTO, PostSearchDocument } from "@rezics/contract";
import type React from "react";
import { RemarkCard } from "./RemarkCard";

function mapPostSearchDocToPostDTO(doc: PostSearchDocument): PostDTO {
  return {
    unitId: doc.id,
    authorUserId: doc.authorUserId,
    author: {
      unitId: doc.authorUserId,
      name: doc.authorName ?? "",
      slug: doc.authorSlug ?? undefined,
      avatar: doc.authorAvatar ?? undefined,
    },
    targetUnitId: doc.targetUnitId,
    realmUnitId: doc.realmUnitId,
    body: doc.body,
    rootPostUnitId: doc.rootPostUnitId,
    parentPostUnitId: doc.parentPostUnitId,
    kind: doc.kind as any,
    depth: doc.depth,
    sortPath: doc.sortPath,
    replyCount: doc.replyCount,
    directReplyCount: doc.directReplyCount,
    lastReplyAt: doc.lastReplyAt,
    isLocked: doc.isLocked,
    scoreEntryId: doc.scoreEntryId,
    extra: doc.extra as any,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

interface RemarkListProps {
  targetUnitId: string;
  limit?: number;
}

export const RemarkList: React.FC<RemarkListProps> = ({
  targetUnitId,
  limit = 20,
}) => {
  const { data, isLoading } = usePostSearchQuery({
    kind: "REMARK",
    targetUnitId,
    limit,
  });

  const remarks = data?.items?.map(mapPostSearchDocToPostDTO) ?? [];

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
      {remarks.map((remark) => (
        <RemarkCard key={remark.unitId} remark={remark} />
      ))}
    </Box>
  );
};
