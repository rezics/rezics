import { Badge, Separator, Skeleton } from "@rezics/ui/shadcn";
import { TextLink } from "@/shared/ui/link";
import type React from "react";
import {
  AnnouncementFeedSection,
  type PinboardAnnouncementItem,
} from "@/pinboard";
import { Bell as NotificationsRoundedIcon } from "lucide-react";
import * as m from "@rezics/i18n/messages";

function formatRelative(dateIso: string): string {
  const ms = Date.now() - new Date(dateIso).getTime();
  const h = Math.floor(ms / 36e5);
  if (h < 1) return m.page_home_noticeboard_time_just_now();
  if (h < 24) return m.page_home_noticeboard_time_hours_ago_other({ count: h });
  const d = Math.floor(h / 24);
  if (d < 7) return m.page_home_noticeboard_time_days_ago_other({ count: d });
  const w = Math.floor(d / 7);
  return m.page_home_noticeboard_time_weeks_ago_other({ count: w });
}

function NoticeBoardHeader({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="p-2 flex items-center justify-between">
        <div className="flex flex-row gap-3 items-center">
          <div className="w-12 h-12 inline-flex items-center justify-center rounded-[10px] shadow-sm bg-brand-fill text-white">
            <NotificationsRoundedIcon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-text-secondary">
              {m.page_home_noticeboard_caption()}
            </p>
            <p className="text-base font-semibold">
              {m.page_home_noticeboard_title()}
            </p>
          </div>
        </div>
        <TextLink
          to="/notice"
          underline="hover"
          color="primary"
          variant="body2"
        >
          {m.common_view_all()}
        </TextLink>
      </div>

      <Separator />
    </div>
  );
}

function NoticeBoardItem({ item }: { item: PinboardAnnouncementItem }) {
  return (
    <div className="mb-1">
      <a
        href={item.link ?? "#"}
        className="block p-2 rounded-md border border-border-whisper bg-surface-elevated transition-colors duration-150 hover:border-brand-fill group"
      >
        <div className="flex flex-row gap-3 items-start w-full">
          <Badge variant={item.pin ? "default" : "outline"} className="mt-0.5">
            {item.pin ? m.common_pinned() : m.common_new()}
          </Badge>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primary truncate min-w-0">
              {item.title}
            </p>
            {item.content && (
              <p
                className="text-sm text-text-secondary mt-1 overflow-hidden"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {item.content}
              </p>
            )}
            <p className="text-xs text-text-secondary opacity-60 mt-1 block">
              {formatRelative(item.date)}
            </p>
          </div>
          <p
            className={`text-sm text-text-secondary opacity-60 ml-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ${item.link ? "visible" : "invisible"}`}
          >
            →
          </p>
        </div>
      </a>
    </div>
  );
}

export const NoticeBoard: React.FC = () => {
  return (
    <div className="w-full h-full flex flex-col">
      <NoticeBoardHeader className="sticky top-0 z-10 rounded-lg" />

      <div className="flex-1 overflow-y-auto space-y-3 mt-3 p-2">
        <AnnouncementFeedSection
          loadingFallback={
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 rounded" />
              <Skeleton className="h-4 rounded" />
              <Skeleton className="h-4 rounded" />
              <Skeleton className="h-4 rounded" />
            </div>
          }
        >
          {(items) => {
            if (items.length === 0) {
              return (
                <p className="text-sm text-text-secondary">
                  {m.page_home_noticeboard_empty()}
                </p>
              );
            }
            return (
              <ul className="max-h-full overflow-auto pr-1 list-none m-0 p-0">
                {items.map((item) => (
                  <li key={item.id}>
                    <NoticeBoardItem item={item} />
                  </li>
                ))}
              </ul>
            );
          }}
        </AnnouncementFeedSection>
      </div>
    </div>
  );
};
