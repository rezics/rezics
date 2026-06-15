import { getI18nRuntime } from "@rezics/i18n/runtime";
import { Badge, Separator, Skeleton } from "@rezics/ui/shadcn";
import { Bell as NotificationsRoundedIcon } from "lucide-react";
import type React from "react";
import {
  AnnouncementStreamSection,
  type PinboardAnnouncementItem,
} from "@/pinboard";
import { TextLink } from "@/shared/ui/link";

/**
 * 通知公告板组件
 *
 * 固定头部布局，下方为可滚动公告列表区域。头部包含通知图标、标题和"查看全部"链接。
 * 列表项支持新增/置顶徽章、标题、描述摘要（2行截断）和相对时间显示。
 *
 * 响应式设计（单一响应列表布局，无断点差异）
 *
 * 固定高度容器（通常用于 sidebar）:
 * ┌────────────────────────────────────┐
 * │ [icon]  标题                  查看全部 │ 头部 sticky top-0 z-10
 * │ ──────────────────────────────────  │ separator
 * │ [NEW] 公告标题                       │ 可滚动区域
 * │        公告摘要内容摘要...        →  │ 每项 py-2 px-2, 列表 gap-2
 * │        2 小时前                      │ 描述 2 行截断
 * │                                     │
 * │ [PIN] 置顶公告标题                   │
 * │       其他内容摘要...             →  │
 * │       3 天前                        │
 * └────────────────────────────────────┘
 *
 * 宽屏平版（>=768px）:
 * ┌──────────────────────────────────────────┐
 * │ [icon]  标题                      查看全部 │ 同上，容器更宽
 * │ ────────────────────────────────────────  │
 * │ [NEW] 较长的公告标题可多行显示不截断      │
 * │        公告摘要内容摘要...              →  │
 * └──────────────────────────────────────────┘
 *
 * 空列表状态:
 * ┌────────────────────────────────────┐
 * │ [icon]  标题                  查看全部 │
 * │ ──────────────────────────────────  │
 * │ 暂无公告                              │ text-sm text-text-secondary
 * │                                     │
 * └────────────────────────────────────┘
 *
 * 窄屏处理：列表宽度依赖容器，超出内容使用 truncate/line-clamp；
 * 悬停效果：列表项边框和箭头显示动画（transition-colors/opacity）。
 */
export const NoticeBoard: React.FC = () => {
  return (
    <div className="w-full h-full flex flex-col">
      <NoticeBoardHeader className="sticky top-0 z-10 rounded-lg" />

      <div className="flex-1 overflow-y-auto space-y-3 mt-3 p-2">
        <AnnouncementStreamSection
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
                  {getI18nRuntime().i18n.t("page:home_noticeboard_empty")}
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
        </AnnouncementStreamSection>
      </div>
    </div>
  );
};

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
              {getI18nRuntime().i18n.t("page:home_noticeboard_caption")}
            </p>
            <p className="text-base font-semibold">
              {getI18nRuntime().i18n.t("page:home_noticeboard_title")}
            </p>
          </div>
        </div>
        <TextLink
          to="/notice"
          underline="hover"
          color="primary"
          variant="body2"
        >
          {getI18nRuntime().i18n.t("common:view_all")}
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
            {item.pin
              ? getI18nRuntime().i18n.t("common:pinned")
              : getI18nRuntime().i18n.t("common:new")}
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

function formatRelative(dateIso: string): string {
  const ms = Date.now() - new Date(dateIso).getTime();
  const h = Math.floor(ms / 36e5);
  if (h < 1)
    return getI18nRuntime().i18n.t("page:home_noticeboard_time_just_now");
  if (h < 24)
    return getI18nRuntime().i18n.t(
      "page:home_noticeboard_time_hours_ago_other",
      { count: h },
    );
  const d = Math.floor(h / 24);
  if (d < 7)
    return getI18nRuntime().i18n.t(
      "page:home_noticeboard_time_days_ago_other",
      { count: d },
    );
  const w = Math.floor(d / 7);
  return getI18nRuntime().i18n.t("page:home_noticeboard_time_weeks_ago_other", {
    count: w,
  });
}
