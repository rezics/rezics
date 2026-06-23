"use client";

import { SectionBoundary } from "@/components/SectionBoundary";
import { useT } from "@/lib/i18n/locale";

/**
 * 用户收藏列表：已收藏的帖子/书籍/书摘等。
 * max-w-3xl mx-auto，分页加载。
 */
export default function BookmarksPage() {
  const [t] = useT();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">{t.bookmarks.heading}</h1>
      <SectionBoundary>
        <div className="text-muted-foreground py-12 text-center text-sm">
          {t.bookmarks.empty}
        </div>
      </SectionBoundary>
    </div>
  );
}
