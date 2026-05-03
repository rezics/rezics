import { Rating } from "@mui/material";
import type React from "react";
import { useTranslation } from "react-i18next";
import { Star } from "lucide-react";

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
  const { t } = useTranslation();
  const hasRating = rating > 0;

  if (variant === "inline") {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs font-bold tracking-[0.12em] uppercase text-white/65">
          {t("book.hero.score.rezics_label", "REZICS SCORE")}
        </span>
        {hasRating ? (
          <div className="flex items-center gap-1.5 min-h-[2.25rem] text-white">
            <Star color={"#f5b942"} size={30} />
            <div className="flex flex-col items-start leading-tight">
              <span className="inline-flex items-baseline gap-1">
                <span className="text-xl font-semibold tabular-nums leading-none">
                  {rating}
                </span>
                <span className="text-xs text-white/70">/&nbsp;10</span>
              </span>
              <span className="text-xs text-white/55 tabular-nums">
                {typeof count === "number" && count > 0
                  ? t("book.hero.score.count", "{{count}} 人評分", { count })
                  : t("book.hero.score.empty_short", "尚無評分")}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 min-h-[2.25rem] text-white/70">
            <Star color={"rgba(255,255,255,0.35)"} size={30} />
            <div className="flex flex-col items-start leading-tight">
              <span className="text-base font-medium text-white/80">
                {t("book.hero.score.empty", "尚無評分")}
              </span>
              <span className="text-xs text-white/45">
                {t("book.hero.score.be_first", "成為第一個評分者")}
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
          {t("book.hero.score.label", "READER SCORE")}
        </span>
        <Rating
          value={0}
          precision={0.5}
          onChange={(_, v) => onRate?.(v ?? 0)}
          readOnly={!onRate}
          sx={{
            "& .MuiRating-iconEmpty": { color: "rgba(255,255,255,0.3)" },
          }}
        />
        <span className="text-xs text-white/70">
          {t("book.hero.score.empty", "尚無評分")}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1 text-white">
      <span className="text-[0.7rem] uppercase tracking-wider text-white/60">
        {t("book.hero.score.label", "READER SCORE")}
      </span>
      <div className="flex items-baseline gap-1">
        <Star color={"#f5b942"} size={28} />
        <span className="text-3xl font-semibold leading-none">{rating}</span>
        <span className="text-base text-white/70">/&nbsp;10</span>
      </div>
      {typeof count === "number" && count > 0 && (
        <span className="text-xs text-white/70">
          {t("book.hero.score.count", "{{count}} 人評分", { count })}
        </span>
      )}
    </div>
  );
};
