import { postQueries } from "@rezics/api/post/post";
import { type PostDTO, PostKind } from "@rezics/contract";
import { RatingInput } from "@rezics/ui";
import { Link } from "@/shared/ui/link";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Skeleton,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import * as m from "@rezics/i18n/messages";

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
          {m.book_hero_featured_review_empty_quote()}
          {QUOTE_CLOSE}
        </p>
        <Link
          to="/review/book/$bookId"
          params={{ bookId }}
          className="text-sm text-white/70 hover:text-white underline-offset-4 hover:underline"
        >
          {m.book_hero_featured_review_write_cta()}
        </Link>
      </div>
    );
  }

  const score = mockReviewScore(review);
  const author = review.author;
  const body = (review.body ?? "").trim();

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
        {body || m.book_hero_featured_review_empty_body()}
        {QUOTE_CLOSE}
      </p>

      <div className="flex items-center gap-2 text-white/85">
        {author?.avatar && (
          <Avatar className="w-6 h-6">
            <AvatarImage src={author.avatar} alt={author.name ?? ""} />
            <AvatarFallback>{(author.name ?? "?").slice(0, 1)}</AvatarFallback>
          </Avatar>
        )}
        <span className="text-sm font-medium">
          {author?.name ?? m.book_hero_featured_review_unknown_author()}
        </span>
        {score != null && (
          <div className="ml-1">
            <RatingInput
              value={Math.round(score)}
              onChange={() => {}}
              readOnly
              size="sm"
              aria-label="review score"
            />
          </div>
        )}
      </div>

      <Link
        to="/review/book/$bookId"
        params={{ bookId }}
        className="text-sm text-white/80 hover:text-white underline-offset-4 hover:underline self-start"
      >
        {m.book_hero_featured_review_read_full()}
      </Link>
    </div>
  );
};
