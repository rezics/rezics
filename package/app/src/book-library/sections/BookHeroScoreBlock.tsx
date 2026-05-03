import { Star } from "@mui/icons-material";
import { Rating } from "@mui/material";
import type React from "react";
import { useTranslation } from "react-i18next";

interface BookHeroScoreBlockProps {
  /** Average score, 0–10 scale, 0 means no ratings yet. */
  rating: number;
  /** Number of ratings contributing to the average. */
  count?: number;
  /** Optional onRate handler; when provided + rating==0, shows interactive rater. */
  onRate?: (next: number) => void;
}

export const BookHeroScoreBlock: React.FC<BookHeroScoreBlockProps> = ({
  rating,
  count,
  onRate,
}) => {
  const { t } = useTranslation();
  const hasRating = rating > 0;

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
        <Star sx={{ color: "#f5b942", fontSize: 28 }} />
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
