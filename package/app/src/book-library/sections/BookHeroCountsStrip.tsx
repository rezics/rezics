import { ArrowForward } from "@mui/icons-material";
import { postQueries } from "@rezics/api/post/post";
import { shelfQueries } from "@rezics/api/shelf/shelf";
import { tagQueries } from "@rezics/api/tag/tag.queries";
import { PostKind } from "@rezics/contract";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useTranslation } from "react-i18next";

interface BookHeroCountsStripProps {
  bookId: string;
}

type CountRow = {
  key: string;
  label: string;
  count: number;
  to: "/review/book/$bookId" | "/shelf/book/$bookId" | "/tag/book/$bookId";
  emptyCta: string;
};

export const BookHeroCountsStrip: React.FC<BookHeroCountsStripProps> = ({
  bookId,
}) => {
  const { t } = useTranslation();

  const { data: reviewData } = useQuery({
    ...postQueries.byTarget(bookId, { kind: PostKind.REVIEW, limit: 1 }),
    enabled: Boolean(bookId),
  });
  const { data: shelfData } = useQuery({
    ...shelfQueries.list({ containsItemRef: bookId, limit: 1 }),
    enabled: Boolean(bookId),
  });
  const { data: tagsData } = useQuery({
    ...tagQueries.forUnit(bookId),
    enabled: Boolean(bookId),
  });

  // MOCK: total counts — preview endpoints return only a small page, not a
  // total. Falls back to "show 0 / >0" until counts land on the API.
  const reviewCount = reviewData?.posts?.length ?? 0;
  const shelfCount = shelfData?.shelves?.length ?? 0;
  const tagCount = tagsData?.tags?.length ?? 0;

  const rows: CountRow[] = [
    {
      key: "reviews",
      label: t("book.hero.counts.reviews", "書評"),
      count: reviewCount,
      to: "/review/book/$bookId",
      emptyCta: t("book.hero.counts.reviews_cta", "撰寫第一篇書評"),
    },
    {
      key: "shelves",
      label: t("book.hero.counts.shelves", "書架"),
      count: shelfCount,
      to: "/shelf/book/$bookId",
      emptyCta: t("book.hero.counts.shelves_cta", "加入第一個書架"),
    },
    {
      key: "tags",
      label: t("book.hero.counts.tags", "標籤"),
      count: tagCount,
      to: "/tag/book/$bookId",
      emptyCta: t("book.hero.counts.tags_cta", "新增第一個標籤"),
    },
  ];

  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <li key={row.key}>
          <Link
            to={row.to}
            params={{ bookId }}
            className="group flex items-center justify-between gap-3 py-1 text-sm text-white/85 hover:text-white"
          >
            {row.count > 0 ? (
              <>
                <span>{row.label}</span>
                <span className="font-medium tabular-nums">{row.count}</span>
              </>
            ) : (
              <>
                <span className="text-white/70">{row.emptyCta}</span>
                <ArrowForward
                  sx={{
                    fontSize: 14,
                    opacity: 0.5,
                    transition: "transform 200ms",
                  }}
                  className="group-hover:translate-x-0.5"
                />
              </>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
};
