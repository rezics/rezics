import { realmListQuery } from "@rezics/api/realm/realm";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { DomainCarousel } from "@rezics/ui/composite/carousel/DomainCarousel.tsx";
import { buttonVariants } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { QueryErrorDisplay } from "@/core";
import { RealmCard } from "@/realm";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { AppSafeLink } from "@/shared/ui/link";
import { officialZoneHref } from "@/zone";

/**
 * Home section displaying top 5 public realms sorted by member count.
 * 主页部分显示按成员数排序的前5个公共领域。
 *
 * Responsive layout: carousel on mobile/tablet, grid on desktop.
 * Respects user's language preferences and read language settings.
 * 响应式布局：移动设备/平板电脑上为轮播，桌面上为网格。
 * 尊重用户的语言偏好和阅读语言设置。
 *
 * Desktop (md+):
 * ┌──────────────────────────────────────────┐
 * │ Active Realms                    [More]   │
 * │ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
 * │ │ Realm 1  │ │ Realm 2  │ │ Realm 3  │ │
 * │ ├──────────┤ ├──────────┤ ├──────────┤ │
 * │ │ 234 members
 * │ │ Realm 4  │ │ Realm 5  │                 │
 * │ └──────────┘ └──────────┘                 │
 * └──────────────────────────────────────────┘
 *
 * Tablet (sm-md):
 * ┌──────────────────────────┐
 * │ Active Realms [More]     │
 * │ ┌──────────┐             │
 * │ │ Realm 1  │ Realm 2...  │
 * │ │ 234 mbrs │ (carousel)  │
 * │ └──────────┘             │
 * └──────────────────────────┘
 *
 * Mobile (xs-sm):
 * ┌────────────────────┐
 * │ Active Realms      │
 * │ [More]             │
 * │ ┌────────────────┐ │
 * │ │ Realm 1        │ │
 * │ │ 234 members    │ │
 * │ │ (swipeable)    │ │
 * │ └────────────────┘ │
 * └────────────────────┘
 *
 * Loading state:
 * ┌──────────────────────────────────────────┐
 * │ Active Realms                            │
 * │ ⟳ Loading...                             │
 * └──────────────────────────────────────────┘
 */
export const ActiveRealmsSection: React.FC = () => {
  const { t } = useTranslation(["page"]);
  const readLanguage = useReadLanguageContext();
  const { data, isLoading, error } = useQuery({
    ...realmListQuery({
      isPublic: true,
      sort: { field: "memberCount", order: "desc" },
      limit: 5,
      languages: readLanguage.languages,
      appLocale: readLanguage.appLocale,
    }),
    enabled: readLanguage.ready,
  });

  const realms = data?.realms ?? [];

  if (error) {
    return <QueryErrorDisplay error={error} />;
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">
          {t("page:home_sections_active_realms_title")}
        </h2>
        <AppSafeLink
          href={officialZoneHref("realms")}
          className={buttonVariants({ variant: "ghost" })}
        >
          {t("page:home_sections_active_realms_more")}
        </AppSafeLink>
      </div>
      {isLoading ? (
        <Spinner size="sm" />
      ) : (
        <>
          <div className="sm:hidden">
            <DomainCarousel
              items={realms}
              itemKey={(realm) => realm.unitId}
              itemClassName="pl-4 basis-[86%] xsm:basis-[62%]"
              showArrows={false}
              wheelScroll
              ariaLabel={t("page:home_sections_active_realms_title")}
              renderItem={(realm) => <RealmCard realm={realm} />}
            />
          </div>
          <div className="hidden sm:grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {realms.map((realm) => (
              <RealmCard key={realm.unitId} realm={realm} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
