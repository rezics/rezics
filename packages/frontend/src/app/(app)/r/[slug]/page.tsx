import { SectionBoundary } from "@/components/SectionBoundary";

/**
 * Realm detail — posts tab (default).
 * Realm 详情页 — 帖子 tab（默认）。
 *
 * Layout provides the shared realm header and tab navigation.
 * 布局层提供共享的 realm 页头和 tab 导航。
 */
export default function RealmPage() {
  return (
    <SectionBoundary>
      <div className="text-muted-foreground py-8 text-center text-sm">
        Post feed coming soon.
      </div>
    </SectionBoundary>
  );
}
