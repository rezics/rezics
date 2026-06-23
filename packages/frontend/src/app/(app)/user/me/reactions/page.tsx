"use client";

import { SectionBoundary } from "@/components/SectionBoundary";
import { useT } from "@/lib/i18n/locale";

/**
 * 用户反应历史：点赞/收藏等反应记录。
 */
export default function MyReactionsPage() {
  const [t] = useT();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">{t.myReactions.heading}</h1>
      <SectionBoundary>
        <div className="text-muted-foreground py-12 text-center text-sm">
          {t.myReactions.empty}
        </div>
      </SectionBoundary>
    </div>
  );
}
