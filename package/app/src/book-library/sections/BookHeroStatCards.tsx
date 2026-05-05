import { postQueries } from "@rezics/api/post/post";
import { shelfQueries } from "@rezics/api/shelf/shelf";
import { tagQueries } from "@rezics/api/tag/tag.queries";
import { PostKind } from "@rezics/contract";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useTranslation } from "react-i18next";
import {
  BookMarked as CollectionsBookmarkOutlined,
  Tag as LocalOfferOutlined,
  MessageSquareText as RateReviewOutlined,
} from "lucide-react";

interface BookHeroStatCardsProps {
  bookId: string;
  /** Subset of stat keys to render as cards. Defaults to all available stats. */
  cardKeys?: BookHeroStatKey[];
}

export type BookHeroStatKey = "reviews" | "shelves" | "tags";

/** Default set promoted to big-icon cards. Stats outside this list fall through
 *  to the inline-link list rendered below the metadata block. */
export const DEFAULT_STAT_CARD_KEYS: BookHeroStatKey[] = [
  "reviews",
  "shelves",
  "tags",
];

const TINT_CYCLE = ["bg-white/5"] as const;
// const TINT_CYCLE = ["bg-white/10", "color-mix-brand-15", "bg-white/5"] as const;

const BRAND_TINT_STYLE: React.CSSProperties = {
  backgroundColor:
    "color-mix(in srgb, var(--colors-brand-fill, #f4606c) 18%, transparent)",
};

export const BookHeroStatCards: React.FC<BookHeroStatCardsProps> = ({
  bookId,
  cardKeys = DEFAULT_STAT_CARD_KEYS,
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
  // total. Falls back to the page length until counts land on the API.
  const reviewCount = reviewData?.posts?.length ?? 0;
  const shelfCount = shelfData?.shelves?.length ?? 0;
  const tagCount = tagsData?.tags?.length ?? 0;

  type StatDef = {
    key: BookHeroStatKey;
    icon: React.ReactElement;
    count: number;
    label: string;
    to: "/review/book/$bookId" | "/shelf/book/$bookId" | "/tag/book/$bookId";
  };

  const allStats: StatDef[] = [
    {
      key: "reviews",
      icon: <RateReviewOutlined size={36} />,
      count: reviewCount,
      label: t("book.hero.stat.reviews", "篇書評"),
      to: "/review/book/$bookId",
    },
    {
      key: "shelves",
      icon: <CollectionsBookmarkOutlined size={36} />,
      count: shelfCount,
      label: t("book.hero.stat.shelves", "個書架"),
      to: "/shelf/book/$bookId",
    },
    {
      key: "tags",
      icon: <LocalOfferOutlined size={36} />,
      count: tagCount,
      label: t("book.hero.stat.tags", "個標籤"),
      to: "/tag/book/$bookId",
    },
  ];

  const visible = allStats.filter((s) => cardKeys.includes(s.key));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 h-full">
      {visible.map((stat, i) => {
        const tint = TINT_CYCLE[i % TINT_CYCLE.length];
        // const isBrand = tint === "color-mix-brand-15";
        const isBrand = false;
        return (
          <Link
            key={stat.key}
            to={stat.to}
            params={{ bookId }}
            className={`flex items-center justify-center gap-4 rounded-xl px-5 py-4 text-white transition hover:bg-white/15 flex-1 min-h-[72px] ${
              isBrand ? "" : tint
            }`}
            style={isBrand ? BRAND_TINT_STYLE : undefined}
          >
            <div className="flex flex-col items-center gap-0.5 min-w-0">
              <span className="text-white/90 shrink-0">{stat.icon}</span>
              <div className="text-center">
                <span className="text-2xl font-semibold leading-none tabular-nums">
                  {stat.count}
                </span>
                <span className="text-sm text-white/75">{stat.label}</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
};
