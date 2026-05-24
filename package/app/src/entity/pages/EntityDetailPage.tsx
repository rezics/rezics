import { entityDetailQueryOptions, useEntity } from "@rezics/api/entity";
import { useServerPermission } from "@rezics/api/hooks";
import { BasicAdminPermission } from "@rezics/contract";
import * as m from "@rezics/i18n/messages";
import { Spinner } from "@rezics/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@rezics/ui/shadcn";
import { useState } from "react";
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
 *
 * import { AwardsTab, hasAwardsData } from "../sections/AwardsTab";
 */

/*
 * NEWS_TAB: uncomment when a news/press data source lands.
 *   Tab registration in `tabs[]` below AND the JSX block must both be
 *   uncommented. See entity detail page spec.
 *
 * import { NewsTab, hasNewsData } from "../sections/NewsTab";
 */

interface EntityDetailPageProps {
  unitId: string;
}

export function EntityDetailPage({ unitId }: EntityDetailPageProps) {
  const { data: entity, isLoading, error } = useEntity(unitId);
  const permission = useServerPermission();

  // Hooks must run unconditionally — call works hook with current id regardless
  // of whether the entity is loaded yet.
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
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-lg font-semibold text-text-primary">
          {m.entity_not_found()}
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          {m.entity_not_found_description()}
        </p>
      </div>
    );
  }

  const tr = getEntityTranslation(entity, activeLanguage);
  const canEdit = permission ? BasicAdminPermission(permission) : false;

  const tabs: Array<{ value: string; label: () => string; show: boolean }> = [
    {
      value: "overview",
      label: m.entity_tab_overview,
      show: hasOverviewData(entity, activeLanguage),
    },
    {
      value: "works",
      label: m.entity_tab_works,
      show: works.length > 0,
    },
    {
      value: "about",
      label: m.entity_tab_about,
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
          {tr?.summary ?? m.entity_no_content()}
        </p>
      )}
    </div>
  );
}

export { entityDetailQueryOptions };
