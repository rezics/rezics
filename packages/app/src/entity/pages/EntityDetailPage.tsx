/**
 * Entity detail page displaying entity information across multiple tabs.
 * 展示实体详情的页面，包含多个标签页。
 *
 * Layout structure with hero section and tabbed content areas.
 * 包含 hero 区块和选项卡式内容的布局结构。
 *
 * Mobile (<640px):
 * +--40px--+
 * |  Hero  |  px-4 vertical spacing
 * |  Tabs  |
 * +--------+
 *
 * Tablet (640-1023px):
 * +-------60px-------+
 * |      Hero        |  px-4 wider padding
 * |      Tabs        |
 * +------------------+
 *
 * Desktop (1024-1535px):
 * +--------80px--------+
 * |       Hero         |  max-w-5xl centered
 * |       Tabs         |  mt-8 spacing
 * +--------------------+
 *
 * Ultra-wide (>=1536px):
 * +----------100px---------+
 * |         Hero           |  max-w-5xl constraint
 * |         Tabs           |  py-8 vertical padding
 * +------------------------+
 */

import {
  entityDetailQueryOptions,
  useEntity,
} from "@rezics/contract/api/entity/entity.queries";
import { useServerPermission } from "@rezics/contract/api/hooks/useServerPermission";
import { BasicAdminPermission } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { getI18nRuntime } from "@rezics/i18n/runtime";
import { Spinner } from "@rezics/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@rezics/ui/shadcn";
import { useState } from "react";
import {
  isApiNotFoundError,
  QueryErrorDisplay,
  ResourceNotFoundState,
} from "@/core";
import { EntityHero } from "../components/EntityHero";
import { useEntityWorks } from "../hooks/useEntityWorks";
import { getEntityLanguages, getEntityTranslation } from "../models/types";
import { AboutTab, hasAboutData } from "../sections/AboutTab";
import { hasOverviewData, OverviewTab } from "../sections/OverviewTab";
import { WorksTab } from "../sections/WorksTab";

/*
 * AWARDS_TAB: uncomment when an awards data source lands.
 *   Tab registration in `tabs[]` below AND the JSX block must both be
 *   uncommented. See entity detail page spec.
 * AWARDS_TAB：当奖项数据源接入后取消注释。
 *   下方 `tabs[]` 中的标签页注册以及 JSX 区块都必须一并取消注释。
 *   参见 entity 详情页规范。
 *
 * import { AwardsTab, hasAwardsData } from "../sections/AwardsTab";
 */

/*
 * NEWS_TAB: uncomment when a news/press data source lands.
 *   Tab registration in `tabs[]` below AND the JSX block must both be
 *   uncommented. See entity detail page spec.
 * NEWS_TAB：当新闻/媒体数据源接入后取消注释。
 *   下方 `tabs[]` 中的标签页注册以及 JSX 区块都必须一并取消注释。
 *   参见 entity 详情页规范。
 *
 * import { NewsTab, hasNewsData } from "../sections/NewsTab";
 */

interface EntityDetailPageProps {
  unitId: string;
}

export function EntityDetailPage({ unitId }: EntityDetailPageProps) {
  const { t } = useTranslation(["entity"]);
  const { data: entity, isLoading, error } = useEntity(unitId);
  const permission = useServerPermission();

  // Hooks must run unconditionally — call works hook with current id regardless
  // of whether the entity is loaded yet.
  // Hooks 必须无条件执行——无论 entity 是否已加载完成，都要用当前 id 调用 works hook。
  const { works } = useEntityWorks(unitId);

  const languages = entity ? getEntityLanguages(entity) : [];
  const initialLanguage = languages[0] ?? "en";
  const [language, setLanguage] = useState<string>(initialLanguage);
  const activeLanguage = languages.includes(language)
    ? language
    : (languages[0] ?? "en");

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (error || !entity) {
    return error && !isApiNotFoundError(error) ? (
      <div className="w-full mx-auto max-w-3xl px-4 py-12">
        <QueryErrorDisplay error={error} />
      </div>
    ) : (
      <ResourceNotFoundState variant="section" />
    );
  }

  const tr = getEntityTranslation(entity, activeLanguage);
  const canEdit = permission ? BasicAdminPermission(permission) : false;

  const tabs: Array<{ value: string; label: () => string; show: boolean }> = [
    {
      value: "overview",
      label: () => getI18nRuntime().i18n.t("entity:tab_overview"),
      show: hasOverviewData(entity, activeLanguage),
    },
    {
      value: "works",
      label: () => getI18nRuntime().i18n.t("entity:tab_works"),
      show: works.length > 0,
    },
    {
      value: "about",
      label: () => getI18nRuntime().i18n.t("entity:tab_about"),
      show: hasAboutData(entity),
    },
    /* AWARDS_TAB: { value: "awards", label: "Awards", show: hasAwardsData(entity) }, */
    /* NEWS_TAB: { value: "news", label: "News", show: hasNewsData(entity) }, */
  ];

  const visibleTabs = tabs.filter((tab) => tab.show);
  const defaultTab =
    visibleTabs.find((tab) => tab.value === "overview")?.value ??
    visibleTabs[0]?.value ??
    "overview";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <EntityHero
        entity={entity}
        language={activeLanguage}
        onLanguageChange={setLanguage}
        canEdit={canEdit}
      />

      {visibleTabs.length > 0 ? (
        <Tabs defaultValue={defaultTab} className="mt-8">
          <TabsList>
            {visibleTabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label()}
              </TabsTrigger>
            ))}
          </TabsList>
          {visibleTabs.some((t) => t.value === "overview") ? (
            <TabsContent value="overview" className="pt-6">
              <OverviewTab entity={entity} language={activeLanguage} />
            </TabsContent>
          ) : null}
          {visibleTabs.some((t) => t.value === "works") ? (
            <TabsContent value="works" className="pt-6">
              <WorksTab entityUnitId={entity.unitId} />
            </TabsContent>
          ) : null}
          {visibleTabs.some((t) => t.value === "about") ? (
            <TabsContent value="about" className="pt-6">
              <AboutTab entity={entity} language={activeLanguage} />
            </TabsContent>
          ) : null}
          {/* AWARDS_TAB:
          {visibleTabs.some((t) => t.value === "awards") ? (
            <TabsContent value="awards" className="pt-6">
              <AwardsTab entity={entity} />
            </TabsContent>
          ) : null}
          */}
          {/* NEWS_TAB:
          {visibleTabs.some((t) => t.value === "news") ? (
            <TabsContent value="news" className="pt-6">
              <NewsTab entity={entity} />
            </TabsContent>
          ) : null}
          */}
        </Tabs>
      ) : (
        <p className="mt-8 text-sm text-text-secondary">
          {tr?.summary ?? t("entity:no_content")}
        </p>
      )}
    </div>
  );
}

export { entityDetailQueryOptions };
