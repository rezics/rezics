import { Skeleton } from "@rezics/ui/shadcn";
import { AnnouncementFeedSection } from "@/pinboard";
import { AnnouncementBar } from "../components/AnnouncementBar";

/**
 * Announcement bar section displaying up to 4 pinned announcements.
 * 公告栏部分最多显示4条固定的公告。
 *
 * Loads announcements via AnnouncementFeedSection and renders them
 * in a full-width bar with optional links and rotation/scrolling.
 * 通过 AnnouncementFeedSection 加载公告，并在全宽栏中呈现，
 * 带有可选链接和旋转/滚动。
 *
 * Desktop (md+):
 * ┌────────────────────────────────────────────┐
 * │ [📢] Announcement 1 - Subtitle        [→] │
 * └────────────────────────────────────────────┘
 *
 * Tablet (sm-md):
 * ┌──────────────────────────────────┐
 * │ [📢] Announcement 1      [→]      │
 * └──────────────────────────────────┘
 *
 * Mobile (xs-sm):
 * ┌──────────────────────┐
 * │ [📢] Announcement 1  │
 * │ Short text...    [→]│
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
export const AnnouncementBarSection = () => {
  return (
    <AnnouncementFeedSection
      loadingFallback={<Skeleton className="h-10 w-full rounded-none" />}
    >
      {(items) => {
        if (items.length === 0) return null;
        return (
          <AnnouncementBar
            announcements={items.map((item) => ({
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
    </AnnouncementFeedSection>
  );
};
