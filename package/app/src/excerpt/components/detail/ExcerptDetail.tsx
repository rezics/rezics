import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import { Box, Typography } from "@mui/material";
import type { ExcerptSource, UnitDTO } from "@rezics/contract";
import { MarkdownContent } from "@rezics/ui/composite/content/MarkdownContent.tsx";
import { SafeLink } from "@rezics/ui/link/SafeLink.tsx";
import { LazyLoadImage } from "@rezics/ui/primitive/image/LazyLoadImage.tsx";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import type React from "react";
import { ReactionBar, type ReactionBarPost } from "@/engagement";
import {
  excerptDetailActions,
  excerptPolicy,
} from "../../models/excerptPolicy";

interface ExcerptDetailProps {
  excerpt: UnitDTO;
  onReplyInvoke?: () => void;
}

export const ExcerptDetail: React.FC<ExcerptDetailProps> = ({
  excerpt,
  onReplyInvoke,
}) => {
  const description = excerpt.translations?.[0]?.description ?? "";
  const source = (excerpt.extra as Record<string, unknown> | null)?.source as
    | ExcerptSource
    | string
    | undefined;
  const dateStr = excerpt.createdAt
    ? new Date(String(excerpt.createdAt)).toLocaleDateString()
    : "";

  const reactionPost: ReactionBarPost = {
    unitId: excerpt.id,
    reactionSummaries: (excerpt as unknown as { reactionSummaries?: unknown[] })
      .reactionSummaries,
    replyCount: (excerpt as unknown as { replyCount?: number }).replyCount,
  };

  return (
    <Box className="flex flex-col gap-4">
      {excerpt.user && (
        <Box className="flex items-center gap-3">
          <Link
            to="/user/$unitId"
            params={{ unitId: excerpt.user.unitId ?? "" }}
            className="flex items-center gap-3"
          >
            <LazyLoadImage
              src={excerpt.user.avatar ?? ""}
              alt={excerpt.user.name ?? ""}
              className="w-16 h-16 rounded-full shadow"
            />
            <Typography variant="body2" fontWeight={600}>
              {excerpt.user.name ?? ""}
            </Typography>
          </Link>
          {dateStr && (
            <Typography variant="caption" color="text.secondary">
              {dateStr}
            </Typography>
          )}
        </Box>
      )}

      <Box className="flex items-start gap-2">
        <FormatQuoteIcon
          sx={{ fontSize: 30, color: "text.secondary", mt: 0.5 }}
        />
        <Box className="flex-1">
          <MarkdownContent content={description} />
        </Box>
      </Box>

      <ExcerptSourceLine source={source} />

      <ReactionBar
        size="lg"
        post={reactionPost}
        policy={excerptPolicy}
        actions={excerptDetailActions}
        onReplyInvoke={onReplyInvoke}
      />
    </Box>
  );
};

function ExcerptSourceLine({ source }: { source?: ExcerptSource | string }) {
  if (!source) return null;
  if (typeof source === "string") {
    return (
      <Typography variant="caption" color="text.disabled">
        —— {source}
      </Typography>
    );
  }
  const href = source.mode === "unit" ? `/unit/${source.unitId}` : source.url;
  return (
    <Typography variant="caption" color="text.disabled">
      ——{" "}
      <SafeLink href={href} className="underline">
        {source.title}
      </SafeLink>
    </Typography>
  );
}
