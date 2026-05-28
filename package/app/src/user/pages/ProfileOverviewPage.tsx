import { contentSearchQueryOptions } from "@rezics/api/meili/meili.queries";
import {
  type ContentSearchDocument,
  contentDocMarkdownFallback,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { useQuery } from "@tanstack/react-query";
import type { FC } from "react";
import { DescriptionBox } from "@/user/components/DescriptionBox";
import { useProfileContext } from "@/user/components/ProfileLayout";
import {
  ProfileActivityCard,
  ProfilePinnedItemCard,
  ProfileStatLink,
} from "@/user/components/ProfileOverviewCards";

export const ProfileOverviewPage: FC = () => {
  const { t } = useTranslation(["common", "settings"]);
const { user, userId } = useProfileContext();

  // MOCK: pinned items — first 6 published units by this user
  const pinnedQuery = useQuery(
    contentSearchQueryOptions({
      userId,
      sort: { field: "publishedAt", order: "desc" },
      limit: 6,
    }),
  );

  // MOCK: recent activity — latest published units
  const recentQuery = useQuery(
    contentSearchQueryOptions({
      userId,
      sort: { field: "updatedAt", order: "desc" },
      limit: 10,
    }),
  );

  const shelvesCountQuery = useQuery({
    ...contentSearchQueryOptions({
      userId,
      type: ["SHELF"],
      sort: { field: "createdAt", order: "desc" },
      limit: 0,
    }),
  });

  const reviewsCountQuery = useQuery({
    ...contentSearchQueryOptions({
      userId,
      type: ["POST"],
      sort: { field: "createdAt", order: "desc" },
      limit: 0,
    }),
  });

  const pinned = pinnedQuery.data?.items ?? [];
  const recent = recentQuery.data?.items ?? [];
  const description = contentDocMarkdownFallback(user.description);

  return (
    <div className="flex flex-col gap-8 py-4">
      {/* Mobile stats — hidden on desktop (shown in sidebar) */}
      <div className="grid grid-cols-2 gap-2 text-sm md:hidden">
        <ProfileStatLink
          label={t("settings:profile_tab_shelves")}
          count={shelvesCountQuery.data?.total}
          to={`/user/${userId}/shelves`}
          variant="compact"
        />
        <ProfileStatLink
          label={t("settings:profile_tab_content")}
          count={reviewsCountQuery.data?.total}
          to={`/user/${userId}/content`}
          variant="compact"
        />
        <ProfileStatLink
          label={t("settings:profile_tab_followers")}
          count={user.followersCount ?? 0}
          to={`/user/${userId}/followers`}
          variant="compact"
        />
        <ProfileStatLink
          label={t("settings:profile_following")}
          count={user.followingsCount ?? 0}
          to={`/user/${userId}/followers?filter=following`}
          variant="compact"
        />
      </div>

      {/* DESCRIPTION.md */}
      {description.trim() !== "" && <DescriptionBox content={description} />}

      {/* Pinned Items */}
      <div>
        <h6 className="text-sm font-semibold mb-3">{t("common:pinned")}</h6>
        {pinned.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {pinned.map((item: ContentSearchDocument) => (
              <ProfilePinnedItemCard
                key={item.id}
                item={item}
                untitledLabel={t("common:untitled")}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">
            {t("settings:profile_no_pinned_items")}
          </p>
        )}
      </div>

      {/* Recent Activity */}
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
                  item.updatedAt
                    ? new Date(item.updatedAt).toLocaleDateString()
                    : undefined
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
