import { Avatar, Rating, Skeleton, Typography } from "@mui/material";
import { postQueries } from "@rezics/api/post/post";
import { type PostDTO, PostKind } from "@rezics/contract";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useTranslation } from "react-i18next";

interface BookHeroFeaturedReviewProps {
  bookId: string;
}

const QUOTE_OPEN = "“";
const QUOTE_CLOSE = "”";

// MOCK: reviewer star rating — not yet exposed on PostDTO; derive a stable
// pseudo-score from the post id until score-per-post lands on the API.
function mockReviewScore(post: PostDTO): number | null {
  const id = post.unitId ?? "";
  if (!id) return null;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 10) + 1) / 2;
}

export const BookHeroFeaturedReview: React.FC<BookHeroFeaturedReviewProps> = ({
  bookId,
}) => {
  const { t } = useTranslation();

  // MOCK: should sort by reaction count once postsByTarget supports it.
  // For now, take the most recent review.
  const { data, isLoading } = useQuery({
    ...postQueries.byTarget(bookId, {
      kind: PostKind.REVIEW,
      limit: 1,
    }),
    enabled: Boolean(bookId),
  });

  const review = data?.posts?.[0];

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton variant="text" width="90%" sx={{ bgcolor: "rgba(255,255,255,0.12)" }} />
        <Skeleton variant="text" width="80%" sx={{ bgcolor: "rgba(255,255,255,0.12)" }} />
        <Skeleton variant="text" width="40%" sx={{ bgcolor: "rgba(255,255,255,0.12)" }} />
      </div>
    );
  }

  if (!review) {
    return (
      <div className="flex flex-col items-start justify-center gap-3 h-full text-white/80">
        <Typography
          className="font-serif italic leading-relaxed"
          sx={{ fontSize: "1.125rem" }}
        >
          {QUOTE_OPEN}
          {t(
            "book.hero.featured_review.empty_quote",
            "等待你的第一篇書評…",
          )}
          {QUOTE_CLOSE}
        </Typography>
        <Link
          to="/review/book/$bookId"
          params={{ bookId }}
          className="text-sm text-white/70 hover:text-white underline-offset-4 hover:underline"
        >
          {t("book.hero.featured_review.write_cta", "撰寫第一篇書評 →")}
        </Link>
      </div>
    );
  }

  const score = mockReviewScore(review);
  const author = review.author;
  const body = (review.body ?? "").trim();

  return (
    <div className="flex flex-col gap-3 text-white">
      <Typography
        className="font-serif leading-relaxed"
        sx={{
          fontSize: "1.125rem",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {QUOTE_OPEN}
        {body || t("book.hero.featured_review.empty_body", "（無正文）")}
        {QUOTE_CLOSE}
      </Typography>

      <div className="flex items-center gap-2 text-white/85">
        {author?.avatar && (
          <Avatar src={author.avatar} alt={author.name ?? ""} sx={{ width: 24, height: 24 }} />
        )}
        <span className="text-sm font-medium">
          {author?.name ?? t("book.hero.featured_review.unknown_author", "匿名讀者")}
        </span>
        {score != null && (
          <Rating
            value={score}
            precision={0.5}
            readOnly
            size="small"
            sx={{
              ml: 0.5,
              "& .MuiRating-iconEmpty": { color: "rgba(255,255,255,0.3)" },
            }}
          />
        )}
      </div>

      <Link
        to="/review/book/$bookId"
        params={{ bookId }}
        className="text-sm text-white/80 hover:text-white underline-offset-4 hover:underline self-start"
      >
        {t("book.hero.featured_review.read_full", "閱讀全文 →")}
      </Link>
    </div>
  );
};
