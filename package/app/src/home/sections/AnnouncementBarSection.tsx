import { Skeleton } from "@rezics/ui/shadcn";
import { AnnouncementFeedSection } from "@/pinboard";
import { AnnouncementBar } from "../components/AnnouncementBar";

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
