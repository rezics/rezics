import {
  book_hero_score_be_first,
  book_hero_score_count,
  book_hero_score_empty,
  book_hero_score_empty_short,
  book_hero_score_label,
  book_hero_score_rezics_label,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { RatingInput } from "@rezics/ui";
import { Star } from "lucide-react";
import type React from "react";

const i18nMessages = {
  book_hero_score_be_first,
  book_hero_score_count,
  book_hero_score_empty,
  book_hero_score_empty_short,
  book_hero_score_label,
  book_hero_score_rezics_label,
};

interface BookHeroScoreBlockProps {
  /** Average score, 0–10 scale, 0 means no ratings yet. */
  rating: number;
  /** Number of ratings contributing to the average. */
  count?: number;
  /** Optional onRate handler; when provided + rating==0, shows interactive rater. */
  onRate?: (next: number) => void;
  /**
   * `inline` renders a compact one-line variant for use beside the title.
   * `block` (default) renders the original right-rail block.
   */
  variant?: "block" | "inline";
}

export const BookHeroScoreBlock: React.FC<BookHeroScoreBlockProps> = ({
  rating,
  count,
  onRate,
  variant = "block",
}) => {
  const m = useMessage(i18nMessages);
  const hasRating = rating > 0;

  if (variant === "inline") {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs font-bold tracking-[0.12em] uppercase text-white/65">
          {m.book_hero_score_rezics_label()}
        </span>
        {hasRating ? (
          <div className="flex items-center gap-1.5 min-h-[2.25rem] text-white">
            <Star className="w-[30px] h-[30px]" style={{ color: "#f5b942" }} />
            <div className="flex flex-col items-start leading-tight">
              <span className="inline-flex items-baseline gap-1">
                <span className="text-xl font-semibold tabular-nums leading-none">
                  {rating}
                </span>
                <span className="text-xs text-white/70">/&nbsp;10</span>
              </span>
              <span className="text-xs text-white/55 tabular-nums">
                {typeof count === "number" && count > 0
                  ? m.book_hero_score_count({ count })
                  : m.book_hero_score_empty_short()}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 min-h-[2.25rem] text-white/70">
            <Star
              className="w-[30px] h-[30px]"
              style={{ color: "rgba(255,255,255,0.35)" }}
            />
            <div className="flex flex-col items-start leading-tight">
              <span className="text-base font-medium text-white/80">
                {m.book_hero_score_empty()}
              </span>
              <span className="text-xs text-white/45">
                {m.book_hero_score_be_first()}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!hasRating) {
    return (
      <div className="flex flex-col items-end gap-1 text-white">
        <span className="text-[0.7rem] uppercase tracking-wider text-white/60">
          {m.book_hero_score_label()}
        </span>
        <RatingInput
          value={null}
          onChange={(v) => onRate?.(v ?? 0)}
          readOnly={!onRate}
          aria-label={m.book_hero_score_label()}
        />
        <span className="text-xs text-white/70">
          {m.book_hero_score_empty()}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1 text-white">
      <span className="text-[0.7rem] uppercase tracking-wider text-white/60">
        {m.book_hero_score_label()}
      </span>
      <div className="flex items-baseline gap-1">
        <Star className="w-7 h-7" style={{ color: "#f5b942" }} />
        <span className="text-3xl font-semibold leading-none">{rating}</span>
        <span className="text-base text-white/70">/&nbsp;10</span>
      </div>
      {typeof count === "number" && count > 0 && (
        <span className="text-xs text-white/70">
          {m.book_hero_score_count({ count })}
        </span>
      )}
    </div>
  );
};
