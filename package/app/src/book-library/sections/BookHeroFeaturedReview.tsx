import { postQueries } from "@rezics/api/post/post";
import { mainMarkdownSource, type PostDTO, PostKind } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { RatingInput } from "@rezics/ui";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Skeleton,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { Link } from "@/shared/ui/link";

interface BookHeroFeaturedReviewProps {
  bookId: string;
}

const QUOTE_OPEN = "“";
const QUOTE_CLOSE = "”";

export const BookHeroFeaturedReview: React.FC<BookHeroFeaturedReviewProps> = ({
  bookId,
}) => {
  const { t } = useTranslation(["book"]);
  const readContext = useReadLanguageContext();
  // MOCK: should sort by reaction count once postsByTarget supports it.
  // For now, take the most recent review.
  // MOCK：一旦 postsByTarget 支持，应按反应数排序。
  // 目前先取最新的一条评论。
  const { data, isLoading } = useQuery({
    ...postQueries.list({
      targetUnitId: bookId,
      kind: PostKind.REVIEW,
      languages: readContext.languages,
      appLocale: readContext.appLocale,
      languageMode: readContext.languageMode,
      limit: 1,
    }),
    enabled: readContext.ready && Boolean(bookId),
  });

  const review = data?.posts?.[0];

  // Show skeleton while loading or before query is enabled
  // 加载中或查询尚未启用时显示骨架屏
  if (isLoading || !readContext.ready) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton
          className="h-4 w-[90%]"
          style={{ background: "rgba(255,255,255,0.12)" }}
        />
        <Skeleton
          className="h-4 w-[80%]"
          style={{ background: "rgba(255,255,255,0.12)" }}
        />
        <Skeleton
          className="h-4 w-[40%]"
          style={{ background: "rgba(255,255,255,0.12)" }}
        />
      </div>
    );
  }

  if (!review) {
    return (
      <div className="flex flex-col items-start justify-center gap-3 h-full text-white/80">
        <p
          className="font-serif italic leading-relaxed"
          style={{ fontSize: "1.125rem" }}
        >
          {QUOTE_OPEN}
          {t("book:hero_featured_review_empty_quote")}
          {QUOTE_CLOSE}
        </p>
        <Link
          to="/review/book/$bookId"
          params={{ bookId }}
          className="text-sm text-white/70 hover:text-white underline-offset-4 hover:underline"
        >
          {t("book:hero_featured_review_write_cta")}
        </Link>
      </div>
    );
  }

  const score = mockReviewScore(review);
  const author = review.author;
  const body = (mainMarkdownSource(review.content) ?? "").trim();

  return (
    <div className="flex flex-col gap-3 text-white">
      <p
        className="font-serif leading-relaxed overflow-hidden"
        style={{
          fontSize: "1.125rem",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
        }}
      >
        {QUOTE_OPEN}
        {body || t("book:hero_featured_review_empty_body")}
        {QUOTE_CLOSE}
      </p>

      <div className="flex min-w-0 items-center gap-2 text-white/85">
        {author?.avatar && (
          <Avatar className="w-6 h-6">
            <AvatarImage src={author.avatar} alt={author.name ?? ""} />
            <AvatarFallback>{(author.name ?? "?").slice(0, 1)}</AvatarFallback>
          </Avatar>
        )}
        <span className="text-sm font-medium min-w-0 truncate">
          {author?.name ?? t("book:hero_featured_review_unknown_author")}
        </span>
        {score != null && (
          <div className="ml-1 shrink-0">
            <RatingInput
              value={Math.round(score)}
              onChange={() => {}}
              readOnly
              size="sm"
              aria-label={t("book:hero_featured_review_score_label")}
            />
          </div>
        )}
      </div>

      <Link
        to="/review/book/$bookId"
        params={{ bookId }}
        className="text-sm text-white/80 hover:text-white underline-offset-4 hover:underline self-start"
      >
        {t("book:hero_featured_review_read_full")}
      </Link>
    </div>
  );
};

// MOCK: reviewer star rating — not yet exposed on PostDTO; derive a stable
// pseudo-score from the post id until score-per-post lands on the API.
// MOCK：评论者星级评分——PostDTO 尚未暴露该字段；在 API 支持每条帖子的评分之前，
// 从帖子 id 派生一个稳定的伪评分。
function mockReviewScore(post: PostDTO): number | null {
  const id = post.unitId ?? "";
  if (!id) return null;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 10) + 1) / 2;
}
