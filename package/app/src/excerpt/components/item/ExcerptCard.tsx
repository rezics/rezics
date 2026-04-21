import FormatQuoteRoundedIcon from "@mui/icons-material/FormatQuoteRounded";
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Typography,
} from "@mui/material";
import type { ExcerptSource, UnitDTO } from "@rezics/contract";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useTranslation } from "react-i18next";
import { ReactionBar, type ReactionBarPost } from "@/engagement";
import { cn } from "@/shared/utils/css-util";
import {
  excerptCardActions,
  excerptPolicy,
} from "../../models/excerptPolicy";

export interface ExcerptCardProps {
  excerpt: UnitDTO;
  className?: string;
}

export const ExcerptCard: React.FC<ExcerptCardProps> = ({
  excerpt,
  className,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const excerptId = excerpt.id;

  const handleOpenExcerpt = () => {
    if (!excerptId) return;
    navigate({ to: "/excerpt/$unitId", params: { unitId: excerptId } });
  };

  const handleReplyInvoke = () => {
    if (!excerptId) return;
    navigate({
      to: "/excerpt/$unitId",
      params: { unitId: excerptId },
      search: { focus: "reply" },
    });
  };

  const source = (excerpt.extra as Record<string, unknown> | null)?.source as
    | ExcerptSource
    | string
    | undefined;
  const description =
    excerpt.translations?.[0]?.description ??
    t("excerpt.card.description.fallback");

  const reactionPost: ReactionBarPost = {
    unitId: excerptId ?? "",
    reactionSummaries: (excerpt as unknown as { reactionSummaries?: unknown[] })
      .reactionSummaries,
    replyCount: (excerpt as unknown as { replyCount?: number }).replyCount,
  };

  return (
    <Card
      elevation={0}
      className={cn("w-full transition-all mb-1", className)}
      onClick={handleOpenExcerpt}
      sx={excerptId ? { cursor: "pointer" } : undefined}
    >
      <CardContent>
        <Box className="flex items-start gap-2">
          <FormatQuoteRoundedIcon
            sx={{ color: "text.secondary", mt: 0.4 }}
            fontSize="small"
          />

          <Box className="min-w-0 flex-1">
            {excerpt.user && (
              <Box
                className="flex items-center gap-2 mb-1"
                onClick={(e) => e.stopPropagation()}
              >
                <Avatar
                  src={excerpt.user.avatar ?? ""}
                  sx={{ width: 20, height: 20 }}
                  variant="rounded"
                />
                <Typography variant="caption" fontWeight={600}>
                  {excerpt.user.name ?? ""}
                </Typography>
              </Box>
            )}
            <Typography
              variant="body2"
              color="text.primary"
              className="line-clamp-3 leading-7"
            >
              {description}
            </Typography>

            <Box className="mt-3 flex items-center justify-between gap-2">
              <ReactionBar
                size="sm"
                post={reactionPost}
                policy={excerptPolicy}
                actions={excerptCardActions}
                onReplyInvoke={handleReplyInvoke}
              />
              <Typography variant="caption" color="text.secondary" noWrap>
                —— <ExcerptCardSource source={source} />
              </Typography>
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

function ExcerptCardSource({ source }: { source?: ExcerptSource | string }) {
  const { t } = useTranslation();
  if (!source) return <>{t("excerpt.card.source.unknown")}</>;
  if (typeof source === "string") return <>{source}</>;
  return <>{source.title}</>;
}

export default ExcerptCard;
