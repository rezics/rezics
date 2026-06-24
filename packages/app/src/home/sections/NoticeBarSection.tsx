import { Skeleton } from "@rezics/ui/shadcn";
import { NoticeStreamSection } from "@/pinboard";
import { NoticeBar } from "../components/NoticeBar";

/**
 * Notice bar section displaying up to 4 pinned notices.
 * 通知栏最多显示 4 条固定通知。
 *
 * Loads notices via NoticeStreamSection and renders them
 * in a full-width bar with optional links and rotation/scrolling.
 * 通过 NoticeStreamSection 加载通知，并在全宽栏中呈现，
 * 带有可选链接和旋转/滚动。
 *
 * Desktop (md+):
 * ┌────────────────────────────────────────────┐
 * │ [icon] Notice 1 - Subtitle            [>] │
 * └────────────────────────────────────────────┘
 *
 * Tablet (sm-md):
 * ┌──────────────────────────────────┐
 * │ [icon] Notice 1          [>]      │
 * └──────────────────────────────────┘
 *
 * Mobile (xs-sm):
 * ┌──────────────────────┐
 * │ [icon] Notice 1      │
 * │ Short text...    [>] │
 * └──────────────────────┘
 *
 * Empty state:
 * ┌────────────────────────────────────────────┐
 * │ (hidden/not rendered)                      │
 * └────────────────────────────────────────────┘
 *
 * Loading state:
 * ┌────────────────────────────────────────────┐
 * │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ (h-10 skeleton)      │
 * └────────────────────────────────────────────┘
 */
export const NoticeBarSection = () => {
  return (
    <NoticeStreamSection
      loadingFallback={<Skeleton className="h-10 w-full rounded-none" />}
    >
      {(items) => {
        if (items.length === 0) return null;
        return (
          <NoticeBar
            notices={items.map((item) => ({
              id: item.id,
              title: item.title,
              content: item.content || item.title,
              date: item.date,
              pin: item.pin,
              link: item.link,
            }))}
            max={4}
          />
        );
      }}
    </NoticeStreamSection>
  );
};
