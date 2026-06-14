import { postQueries } from "@rezics/api/post/post";
import { shelfQueries } from "@rezics/api/shelf/shelf";
import { tagQueries } from "@rezics/api/tag/tag.queries";
import { PostKind } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { useQuery } from "@tanstack/react-query";
import {
  BookMarked as ShelvesBookmarkOutlined,
  Tag as LocalOfferOutlined,
  MessageSquareText as RateReviewOutlined,
} from "lucide-react";
import type React from "react";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { Link } from "@/shared/ui/link";

interface BookHeroStatCardsProps {
  bookId: string;
  /** Subset of stat keys to render as cards. Defaults to all available stats. 要渲染为卡片的统计键子集。默认为所有可用统计项。 */
  cardKeys?: BookHeroStatKey[];
}

export type BookHeroStatKey = "reviews" | "shelves" | "tags";

/** Default set promoted to big-icon cards. Stats outside this list fall through
 *  to the inline-link list rendered below the metadata block.
 *  提升为大图标卡片的默认集合。不在此列表中的统计项会下沉到元数据块
 *  下方渲染的内联链接列表中。 */
export const DEFAULT_STAT_CARD_KEYS: BookHeroStatKey[] = [
  "reviews",
  "shelves",
  "tags",
];

const TINT_CYCLE = ["bg-white/5"] as const;
// const TINT_CYCLE = ["bg-white/10", "color-mix-brand-15", "bg-white/5"] as const;

const BRAND_TINT_STYLE: React.CSSProperties = {
  backgroundColor:
    "color-mix(in srgb, var(--colors-brand-fill, #DB515C) 18%, transparent)",
};

export const BookHeroStatCards: React.FC<BookHeroStatCardsProps> = ({
  bookId,
  cardKeys = DEFAULT_STAT_CARD_KEYS,
}) => {
  const { t } = useTranslation(["book"]);
  const readContext = useReadLanguageContext();
  const { data: reviewData } = useQuery({
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
  const { data: shelfData } = useQuery({
    ...shelfQueries.list({ containsUnitId: bookId, limit: 1 }),
    enabled: Boolean(bookId),
  });
  const { data: tagsData } = useQuery({
    ...tagQueries.forUnit(bookId),
    enabled: Boolean(bookId),
  });

  const reviewCount = reviewData?.total ?? reviewData?.posts?.length ?? 0;
  const shelfCount = shelfData?.total ?? shelfData?.shelves?.length ?? 0;
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
      label: t("book:hero_stat_reviews"),
      to: "/review/book/$bookId",
    },
    {
      key: "shelves",
      icon: <ShelvesBookmarkOutlined size={36} />,
      count: shelfCount,
      label: t("book:hero_stat_shelves"),
      to: "/shelf/book/$bookId",
    },
    {
      key: "tags",
      icon: <LocalOfferOutlined size={36} />,
      count: tagCount,
      label: t("book:hero_stat_tags"),
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
