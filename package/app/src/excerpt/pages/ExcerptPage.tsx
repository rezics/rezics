import { ChatBubbleOutline } from "@mui/icons-material";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import { IconButton, Typography } from "@mui/material";
import { unitQueries } from "@rezics/api/unit/unit.queries";
import type { ExcerptSource } from "@rezics/contract";
import { MarkdownContent } from "@rezics/ui/composite/content/MarkdownContent.tsx";
import { SafeLink } from "@rezics/ui/link/SafeLink.tsx";
import { AccentBar } from "@rezics/ui/primitive/decorative/AccentBar.tsx";
import { LazyLoadImage } from "@rezics/ui/primitive/image/LazyLoadImage.tsx";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { InlinePostForm } from "@/discussion/components/InlinePostForm";
import { ThreadView } from "@/discussion/components/ThreadView";
import {
  MiniActionBar,
  MiniAdminActionBar,
} from "@/engagement/components/MiniActionBar";
import { ReactionStatistics } from "@/engagement/components/ReactionStatistics";
import { excerptRoute } from "@/router";
import { parseReactionSummaries } from "@/shared/utils/reaction-summaries-parser";

export const ExcerptPage: React.FC = () => {
  const { unitId } = excerptRoute.useParams();
  const { t } = useTranslation();
  const commentRef = useRef<HTMLDivElement>(null);
  const handleGoToComments = () => {
    commentRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  // TODO get stats from API
  const stats = {
    replies: 0,
    likes: 0,
    date: new Date().toISOString(),
  };

  const {
    data: excerpt,
    isLoading,
    error: _error,
  } = useQuery(unitQueries.detail(unitId || ""));

  if (isLoading) {
    return <div className="text-center py-10">{t("common.loading")}</div>;
  }

  if (!excerpt?.id) {
    return (
      <div className="text-center py-10 text-red-500">
        {t("excerpt.not_found")}
      </div>
    );
  }

  return (
    <div
      className="w-full max-w-4xl mt-[60px] mx-auto"
      data-testid="booklist-page"
    >
      {/* Head */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center">
            <h2 className="text-2xl font-bold">
              {excerpt.translations?.[0]?.title}
            </h2>

            <div className="ml-auto">
              <MiniAdminActionBar
                editionURL={`/excerpt/${unitId}/edit`}
                userUnitId={excerpt.user?.unitId}
              />
            </div>
          </div>
        </div>
        <div className="flex justify-between items-center">
          {excerpt.user && (
            <div className="flex items-center gap-3">
              <LazyLoadImage
                src={excerpt.user.avatar || ""}
                alt="creator avatar"
                className="w-10 h-10 rounded-full shadow"
              />
              <p className="text-sm">{excerpt.user.name}</p>
            </div>
          )}
          <div className="flex items-center gap-2">
            <MiniActionBar
              handleOnCommentClick={handleGoToComments}
              unitId={unitId || ""}
            />
          </div>
        </div>
      </div>

      <div className="flex items-start mt-4">
        <FormatQuoteIcon
          sx={{
            fontSize: 30,
            color: "text.secondary",
            mr: 1,
            mt: 0.5,
          }}
        />
        <div className="flex-1 mt-2">
          {excerpt.translations?.[0]?.description && (
            <MarkdownContent content={excerpt.translations[0].description} />
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="flex gap-1">
          <ReactionStatistics
            reactionSummaries={parseReactionSummaries(
              excerpt.reactionSummaries,
            )}
          />
          <Typography variant="caption" color="text.secondary">
            {stats?.date}
          </Typography>
        </div>
        <ExcerptSourceLine
          source={(excerpt.extra as Record<string, any>)?.source}
        />
      </div>

      <div ref={commentRef} className="mt-8">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <AccentBar />
            <p className="text-2xl font-bold">{t("review.comments")}</p>
          </div>

          <IconButton size="large" sx={{ fontSize: "1.5rem" }}>
            <ChatBubbleOutline fontSize="inherit" />
          </IconButton>
        </div>

        <InlinePostForm
          targetUnitId={unitId || ""}
          placeholder="Write a reply..."
        />
        <ThreadView rootPostUnitId={unitId || ""} />
        <div className="mb-[200px]" />
      </div>
    </div>
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

export default ExcerptPage;
