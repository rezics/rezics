import { EditOutlined } from "@mui/icons-material";
import { Avatar, Box, IconButton, Typography } from "@mui/material";
import { useCanEdit } from "@rezics/api/hooks";
import type { PostDTO } from "@rezics/contract";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import type React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { parseReactionSummaries } from "@/shared/utils/reaction-summaries-parser";
import { RemarkEditDialog } from "./RemarkEditDialog";

interface RemarkCardProps {
  remark: PostDTO;
}

export const RemarkCard: React.FC<RemarkCardProps> = ({ remark }) => {
  const { t } = useTranslation();
  const rating = (remark.extra as any)?.rating as number | undefined;
  const dateStr = remark.createdAt
    ? new Date(String(remark.createdAt)).toLocaleDateString()
    : "";
  const reactions = parseReactionSummaries(remark.reactionSummaries ?? []);
  const canEdit = useCanEdit({
    resource: "post",
    ownerUnit: { user: remark.author },
  });
  const [editing, setEditing] = useState(false);

  return (
    <Box className="py-3 border-b border-gray-200 dark:border-gray-700">
      <Box className="flex gap-3">
        <Link
          to="/user/$unitId"
          params={{ unitId: remark.author?.unitId ?? "" }}
        >
          <Avatar
            src={remark.author?.avatar ?? ""}
            sx={{ width: 36, height: 36 }}
            variant="rounded"
          />
        </Link>

        <Box className="flex-1">
          <Box className="flex items-center gap-2 mb-1">
            <Typography variant="body2" fontWeight={600}>
              {remark.author?.name ?? "Anonymous"}
            </Typography>
            {rating !== undefined && (
              <Typography variant="caption" color="primary">
                {rating}/10
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary">
              {dateStr}
            </Typography>
            {canEdit && (
              <IconButton
                size="small"
                aria-label={t("common.edit")}
                onClick={() => setEditing(true)}
                sx={{ ml: "auto" }}
              >
                <EditOutlined fontSize="small" />
              </IconButton>
            )}
          </Box>

          <Typography variant="body2" className="whitespace-pre-wrap">
            {remark.body}
          </Typography>

          <Box className="flex items-center gap-3 mt-1">
            <Typography variant="caption" color="text.secondary">
              {reactions.likes ?? 0} likes
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {remark.replyCount ?? 0} replies
            </Typography>
          </Box>
        </Box>
      </Box>
      {editing && (
        <RemarkEditDialog
          remark={remark}
          open={editing}
          onClose={() => setEditing(false)}
        />
      )}
    </Box>
  );
};
