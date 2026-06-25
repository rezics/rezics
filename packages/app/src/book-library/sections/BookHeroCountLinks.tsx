import { postQueries } from "@rezics/contract/api/post/post.queries";
import { shelfQueries } from "@rezics/contract/api/shelf/shelf";
import { tagQueries } from "@rezics/contract/api/tag/tag.queries";
import { PostKind } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { Link } from "@/shared/ui/link";
import type { BookHeroStatKey } from "./BookHeroStatCards";

interface BookHeroCountLinksProps {
  bookId: string;
  /**
   * Stat keys already shown as big-icon cards above; suppressed from the link row.
   * 已在上方大图标卡片中展示的统计项；会从链接行中隐藏。
   */
  excludeKeys?: BookHeroStatKey[];
}

type CountLink = {
  key: BookHeroStatKey;
  to: "/review/book/$bookId" | "/shelf/book/$bookId" | "/tag/book/$bookId";
  label: string;
  count: number;
};

export const BookHeroCountLinks: React.FC<BookHeroCountLinksProps> = ({
  bookId,
  excludeKeys = [],
}) => {
  const { t } = useTranslation(["book"]);
  const readContext = useReadLanguageContext();
  const { data: reviewData } = useQuery({
    ...postQueries.list({
      targetUnitId: bookId,
      kind: PostKind.REVIEW,
      languages: readContext.languages,
      appLocale: readContext.appLocale,
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

  const all: CountLink[] = [
    {
      key: "reviews",
      to: "/review/book/$bookId",
      count: reviewCount,
      label: t("book:hero_count_links_reviews", { count: reviewCount }),
    },
    {
      key: "shelves",
      to: "/shelf/book/$bookId",
      count: shelfCount,
      label: t("book:hero_count_links_shelves", { count: shelfCount }),
    },
    {
      key: "tags",
      to: "/tag/book/$bookId",
      count: tagCount,
      label: t("book:hero_count_links_tags", { count: tagCount }),
    },
  ];

  const links = all.filter((l) => !excludeKeys.includes(l.key));
  if (links.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      {links.map((link) => (
        <Link
          key={link.key}
          to={link.to}
          params={{ bookId }}
          className="text-white/85 hover:text-white underline-offset-4 hover:underline tabular-nums"
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
};
