import { Badge, Separator, Skeleton } from "@rezics/ui/shadcn";
import { TextLink } from "@rezics/ui/primitive/link/TextLink.tsx";
import type { TFunction } from "i18next";
import type React from "react";
import { useTranslation } from "react-i18next";
import {
  AnnouncementFeedSection,
  type PinboardAnnouncementItem,
} from "@/pinboard";
import { Bell as NotificationsRoundedIcon } from "lucide-react";

function formatRelativeWithT(t: TFunction, dateIso: string): string {
  const ms = Date.now() - new Date(dateIso).getTime();
  const h = Math.floor(ms / 36e5);
  if (h < 1) return t("page.home.noticeboard.time.just_now");
  if (h < 24)
    return t("page.home.noticeboard.time.hours_ago_other", { count: h });
  const d = Math.floor(h / 24);
  if (d < 7)
    return t("page.home.noticeboard.time.days_ago_other", { count: d });
  const w = Math.floor(d / 7);
  return t("page.home.noticeboard.time.weeks_ago_other", { count: w });
}

function NoticeBoardHeader({
  className,
  t,
}: {
  className?: string;
  t: TFunction;
}) {
  return (
    <div className={className}>
      <div className="p-2 flex items-center justify-between">
        <div className="flex flex-row gap-3 items-center">
          <div className="w-12 h-12 inline-flex items-center justify-center rounded-[10px] shadow-sm bg-brand-fill text-white">
            <NotificationsRoundedIcon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-text-secondary">
              {t("page.home.noticeboard.caption")}
            </p>
            <p className="text-base font-semibold">
              {t("page.home.noticeboard.title")}
            </p>
          </div>
        </div>
        <TextLink to="/notice" underline="hover" color="primary" variant="body2">
          {t("common.view_all")}
        </TextLink>
      </div>

      <Separator />
    </div>
  );
}

function NoticeBoardItem({
  item,
  t,
}: {
  item: PinboardAnnouncementItem;
  t: TFunction;
}) {
  return (
    <div className="mb-1">
      <a
        href={item.link ?? "#"}
        className="block p-2 rounded-md border border-border-whisper bg-surface-elevated transition-colors duration-150 hover:border-brand-fill group"
      >
        <div className="flex flex-row gap-3 items-start w-full">
          <Badge
            variant={item.pin ? "default" : "outline"}
            className="mt-0.5"
          >
            {item.pin ? t("common.pinned") : t("common.new")}
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
              {formatRelativeWithT(t, item.date)}
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
  const { t } = useTranslation();

  return (
    <div className="w-full h-full flex flex-col">
      <NoticeBoardHeader className="sticky top-0 z-10 rounded-lg" t={t} />

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
                  {t("page.home.noticeboard.empty")}
                </p>
              );
            }
            return (
              <ul className="max-h-full overflow-auto pr-1 list-none m-0 p-0">
                {items.map((item) => (
                  <li key={item.id}>
                    <NoticeBoardItem item={item} t={t} />
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
