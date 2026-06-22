import { bookQueries } from "@rezics/api/book/book";
import type { BookDTO, PublicUser } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Avatar, AvatarFallback, AvatarImage } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useMemo } from "react";
import { HomeSectionShell } from "./HomeSectionShell";

type Book = BookDTO;

export type HomeAuthorSpotlightProps = {
  title?: string;
  limit?: number; // number of books to sample authors from — 从中采样作者的书籍数量
  maxAuthors?: number;
};

/**
 * HomeAuthorSpotlight
 * Collect unique authors from recent books and display them.
 * 从近期书籍中收集去重后的作者并展示。
 */
export const HomeAuthorSpotlight: React.FC<HomeAuthorSpotlightProps> = ({
  title,
  limit = 24,
  maxAuthors = 12,
}) => {
  const { t } = useTranslation(["page"]);
  const resolvedTitle = title ?? t("page:home_sections_author_spotlight");

  const { data, isLoading, error } = useQuery(
    bookQueries.list({ start: 0, limit }),
  );

  const authors = useMemo(() => {
    const books: Book[] = data?.books ?? [];
    const map = new Map<string, PublicUser>();
    for (const b of books) {
      const u = b.user;
      if (u && !map.has(u.unitId)) map.set(u.unitId, u);
      if (map.size >= maxAuthors) break;
    }
    return Array.from(map.values()).slice(0, maxAuthors);
  }, [data, maxAuthors]);

  return (
    <HomeSectionShell title={resolvedTitle} isLoading={isLoading} error={error}>
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {authors.map((a) => (
          <div
            key={a.unitId}
            className="flex items-center gap-3 p-3 rounded border bg-white"
          >
            <Avatar>
              {a.avatar && <AvatarImage src={a.avatar} alt={a.name} />}
              <AvatarFallback>{a.name?.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="font-medium truncate" title={a.name}>
                {a.name}
              </div>
            </div>
          </div>
        ))}
      </div>
    </HomeSectionShell>
  );
};
