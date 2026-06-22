/**
 * ProfileOverviewPage — 用户资料概览页面，展示用户描述、最近活动和移动端统计信息。
 *
 * ┌───────────────────────────────────────┐
 * │ Overview (desktop 1024px+)            │
 * │ ┌─────────────────────────────────────┐
 * │ │ User summary / description section      │
 * │ ├─────────────────────────────────────┤
 * │ │ Recent Activity                     │
 * │ │ • Unit 1 — May 15, 2024            │
 * │ │ • Unit 2 — May 10, 2024            │
 * │ │ • Unit 3 — May 5, 2024             │
 * │ └─────────────────────────────────────┘
 * └───────────────────────────────────────┘
 *
 * ┌─────────────────────────┐
 * │ Overview (tablet 768px) │
 * │ ┌─────────────────────┐ │
 * │ │ Summary box             │ │
 * │ ├─────────────────────┤ │
 * │ │ Recent Activity     │ │
 * │ │ • Unit 1 — May 15   │ │
 * │ │ • Unit 2 — May 10   │ │
 * │ └─────────────────────┘ │
 * └─────────────────────────┘
 *
 * ┌──────────────────┐
 * │ Overview (mobile)│
 * │ ┌──────────────┐ │
 * │ │ [Shelves: 5] │ │
 * │ │ [Content: 3] │ │
 * │ │ [Followers:2]│ │
 * │ │ [Following:1]│ │
 * │ ├──────────────┤ │
 * │ │ Summary box      │ │
 * │ ├──────────────┤ │
 * │ │ Recent Items │ │
 * │ │ • Unit 1     │ │
 * │ └──────────────┘ │
 * └──────────────────┘
 *
 * ┌────────────────────────┐
 * │ Empty State (no items) │
 * │ ┌────────────────────┐ │
 * │ │ No recent activity │ │
 * │ └────────────────────┘ │
 * └────────────────────────┘
 */

import {
  type ContentSearchDocument,
  contentDocMarkdownFallback,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { formatDate } from "@rezics/ui";
import type { FC } from "react";
import { useLocalizedContentSearch } from "@/shared/hooks/useLocalizedMeiliSearch";
import { DescriptionBox } from "@/user/components/DescriptionBox";
import { useProfileContext } from "@/user/components/ProfileLayout";
import {
  ProfileActivityCard,
  ProfileStatLink,
} from "@/user/components/ProfileOverviewCards";

export const ProfileOverviewPage: FC = () => {
  const { t } = useTranslation(["common", "settings"]);
  const { user, userId, profileBasePath } = useProfileContext();

  // MOCK: recent activity — latest published units
  // MOCK：最近动态 —— 最新发布的单元
  const recentQuery = useLocalizedContentSearch({
    userId,
    sort: { field: "updatedAt", order: "desc" },
    limit: 10,
  });

  const shelvesCountQuery = useLocalizedContentSearch({
    userId,
    type: ["SHELF"],
    sort: { field: "createdAt", order: "desc" },
    limit: 0,
  });

  const reviewsCountQuery = useLocalizedContentSearch({
    userId,
    type: ["POST"],
    sort: { field: "createdAt", order: "desc" },
    limit: 0,
  });

  const recent = recentQuery.data?.items ?? [];
  const description = contentDocMarkdownFallback(user.description);

  return (
    <div className="flex flex-col gap-8 py-4">
      {/* Mobile stats — hidden on desktop (shown in sidebar) */}
      {/* 移动端统计 —— 桌面端隐藏（改在侧边栏显示） */}
      <div className="grid grid-cols-2 gap-2 text-sm md:hidden">
        <ProfileStatLink
          label={t("settings:profile_tab_shelves")}
          count={shelvesCountQuery.data?.total}
          to={`${profileBasePath}/shelf`}
          variant="compact"
        />
        <ProfileStatLink
          label={t("settings:profile_tab_content")}
          count={reviewsCountQuery.data?.total}
          to={`${profileBasePath}/content`}
          variant="compact"
        />
        <ProfileStatLink
          label={t("settings:profile_tab_followers")}
          count={user.followersCount ?? 0}
          to={`${profileBasePath}/followers`}
          variant="compact"
        />
        <ProfileStatLink
          label={t("settings:profile_following")}
          count={user.followingsCount ?? 0}
          to={`${profileBasePath}/followers?filter=following`}
          variant="compact"
        />
      </div>

      {/* DESCRIPTION.md */}
      {/* DESCRIPTION.md —— 个人简介 */}
      {description.trim() !== "" && <DescriptionBox content={description} />}

      <div>
        <h6 className="text-sm font-semibold mb-3">
          {t("settings:profile_recent_activity")}
        </h6>
        {recent.length > 0 ? (
          <div className="flex flex-col gap-2">
            {recent.map((item: ContentSearchDocument) => (
              <ProfileActivityCard
                key={item.id}
                item={item}
                untitledLabel={t("common:untitled")}
                dateLabel={
                  item.updatedAt ? formatDate(item.updatedAt) : undefined
                }
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">
            {t("settings:profile_no_recent_activity")}
          </p>
        )}
      </div>
    </div>
  );
};
