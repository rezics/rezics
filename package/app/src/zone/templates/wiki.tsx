import { unitDetailQuery } from "@rezics/api/unit";
import type {
  Language,
  UnitDTO,
  WikiZoneHomepageData,
  WikiZoneHomepageItem,
  WikiZoneHomepageSectionData,
  WikiZoneNavigation,
  WikiZoneNavigationItem,
  WikiZoneTheme,
  WikiZoneTranslatedLabel,
} from "@rezics/contract";
import { useLocale, useTranslation } from "@rezics/i18n/react";
import { EmptyState, SafeLink, Spinner } from "@rezics/ui";
import { Button, Card, CardContent } from "@rezics/ui/shadcn";
import { useQueries } from "@tanstack/react-query";
import type React from "react";
import { useMemo } from "react";
import { KeywordInput, useSearchQuery } from "@/search";
import type { ZoneTemplateProps } from "./types";

type WikiTemplateVariant = "classic" | "media" | "database" | "minimal";

function translatedLabel(
  label: WikiZoneTranslatedLabel | undefined,
  locale: Language,
) {
  if (!label) return null;
  return (
    label.translations[locale] ??
    (label.fallbackLanguage
      ? label.translations[label.fallbackLanguage]
      : undefined) ??
    label.translations.en ??
    Object.values(label.translations).find(Boolean) ??
    null
  );
}

function unitTitle(unit: UnitDTO | undefined, locale: Language) {
  const translations = unit?.translations ?? [];
  return (
    translations.find((item) => item.language === locale)?.title ??
    (unit?.defaultLanguage
      ? translations.find((item) => item.language === unit.defaultLanguage)
          ?.title
      : undefined) ??
    translations.find((item) => item.language === "en")?.title ??
    translations.find((item) => item.title)?.title ??
    null
  );
}

function sectionTitle(
  section: WikiZoneHomepageSectionData["section"],
  locale: Language,
) {
  return translatedLabel(section.title, locale) ?? section.id;
}

function itemTitle(item: WikiZoneHomepageItem, locale: Language) {
  if (item.kind === "navigationItem") {
    const nav = item.item;
    if ("label" in nav && nav.label) {
      return translatedLabel(nav.label, locale) ?? nav.kind;
    }
    return nav.kind;
  }
  return item.title ?? item.kind;
}

function itemSummary(item: WikiZoneHomepageItem) {
  if (
    item.kind === "wikiPost" ||
    item.kind === "entity" ||
    item.kind === "tag"
  ) {
    return item.summary;
  }
  return null;
}

function itemHref(item: WikiZoneHomepageItem) {
  if (item.kind === "wikiPost") return `/post/${item.unitId}`;
  if (item.kind === "entity") return `/entity/${item.entityUnitId}`;
  if (item.kind === "tag") return `/tag/${item.tagUnitId}`;
  if (item.kind === "navigationItem" && "href" in item.item) {
    return item.item.href;
  }
  return null;
}

function gridClass(variant: WikiTemplateVariant) {
  if (variant === "database") return "grid gap-3 md:grid-cols-3";
  if (variant === "minimal") return "grid gap-2";
  return "grid gap-4 md:grid-cols-2";
}

function homepageVariant(
  template: WikiZoneHomepageData["template"] | undefined,
): WikiTemplateVariant | null {
  if (!template) return null;
  if (template === "wiki-classic-home") return "classic";
  if (template === "wiki-media-home") return "media";
  if (template === "wiki-database-home") return "database";
  if (template === "wiki-minimal-home") return "minimal";
  return null;
}

function zoneThemeStyle(theme: WikiZoneTheme | undefined): React.CSSProperties {
  return {
    background: theme?.palette?.background,
    color: theme?.palette?.text,
  };
}

function collectNavigationUnitIds(navigation: WikiZoneNavigation | undefined) {
  const ids = new Set<string>();
  for (const section of navigation?.sections ?? []) {
    if (section.labelUnitId) ids.add(section.labelUnitId);
    for (const item of section.items) {
      if ("labelUnitId" in item && item.labelUnitId) ids.add(item.labelUnitId);
      if (item.kind === "entity") ids.add(item.entityId);
      if (item.kind === "tag") ids.add(item.tagUnitId);
      if (item.kind === "wikiUnit") ids.add(item.unitId);
      if (item.kind === "unit") ids.add(item.unitId);
      if (item.kind === "labelHeading") ids.add(item.labelUnitId);
    }
  }
  return [...ids];
}

function navigationItemFallback(item: WikiZoneNavigationItem) {
  if (item.kind === "entity") return item.entityId;
  if (item.kind === "tag") return item.tagUnitId;
  if (item.kind === "wikiUnit") return item.unitId;
  if (item.kind === "unit") return item.unitId;
  if (item.kind === "external") return item.href;
  if (item.kind === "manualLink") return item.href;
  return item.labelUnitId;
}

function navigationItemLabel(
  item: WikiZoneNavigationItem,
  units: Map<string, UnitDTO>,
  locale: Language,
) {
  if ("label" in item) return translatedLabel(item.label, locale);
  if ("labelUnitId" in item && item.labelUnitId) {
    const label = unitTitle(units.get(item.labelUnitId), locale);
    if (label) return label;
  }
  if (item.kind === "entity")
    return unitTitle(units.get(item.entityId), locale);
  if (item.kind === "tag") return unitTitle(units.get(item.tagUnitId), locale);
  if (item.kind === "wikiUnit")
    return unitTitle(units.get(item.unitId), locale);
  if (item.kind === "unit") return unitTitle(units.get(item.unitId), locale);
  if (item.kind === "labelHeading") {
    return unitTitle(units.get(item.labelUnitId), locale);
  }
  return null;
}

function navigationItemHref(item: WikiZoneNavigationItem) {
  if (item.kind === "entity") return `/entity/${item.entityId}`;
  if (item.kind === "tag") return `/tag/${item.tagUnitId}`;
  if (item.kind === "wikiUnit") return `/post/${item.unitId}`;
  if (item.kind === "unit") return `/unit/${item.unitId}`;
  if (item.kind === "external" || item.kind === "manualLink") return item.href;
  return null;
}

function WikiNavigation({
  navigation,
  placement = "side",
}: {
  navigation: WikiZoneNavigation | undefined;
  placement?: "side" | "top";
}) {
  const locale = useLocale();
  const unitIds = useMemo(
    () => collectNavigationUnitIds(navigation),
    [navigation],
  );
  const unitResults = useQueries({
    queries: unitIds.map((unitId) => unitDetailQuery(unitId)),
  });
  const units = useMemo(
    () =>
      new Map(
        unitResults.flatMap((result, index) =>
          result.data ? [[unitIds[index]!, result.data] as const] : [],
        ),
      ),
    [unitIds, unitResults],
  );
  const sections = navigation?.sections ?? [];

  if (sections.length === 0) return null;

  const content = (
    <div className="flex flex-col gap-5">
      {sections.map((section) => (
        <section key={section.id} className="min-w-0">
          <h2 className="mb-2 text-sm font-medium leading-ui text-text-primary">
            {unitTitle(
              section.labelUnitId ? units.get(section.labelUnitId) : undefined,
              locale,
            ) ??
              translatedLabel(section.label, locale) ??
              section.id}
          </h2>
          <div className="flex flex-col gap-1">
            {section.items.map((item, index) => {
              const label =
                navigationItemLabel(item, units, locale) ??
                navigationItemFallback(item);
              const href = navigationItemHref(item);

              if (item.kind === "labelHeading") {
                return (
                  <p
                    key={`${section.id}-${item.kind}-${index}`}
                    className="mt-3 text-xs font-medium uppercase tracking-normal text-text-tertiary first:mt-0"
                  >
                    {label}
                  </p>
                );
              }

              if (!href) {
                return (
                  <span
                    key={`${section.id}-${item.kind}-${index}`}
                    className="rounded-sm px-2 py-1.5 text-sm leading-ui text-text-tertiary"
                  >
                    {label}
                  </span>
                );
              }

              return (
                <SafeLink
                  key={`${section.id}-${item.kind}-${index}`}
                  href={href}
                  className="rounded-sm px-2 py-1.5 text-sm leading-ui text-text-secondary hover:bg-surface-muted hover:text-text-primary"
                >
                  {label}
                </SafeLink>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );

  if (placement === "top") {
    return (
      <div className="min-w-0 border-border-subtle border-b pb-4">
        <nav aria-label="Wiki navigation">{content}</nav>
      </div>
    );
  }

  return (
    <>
      <aside className="hidden min-w-0 border-border-subtle border-r pr-6 lg:block">
        <nav aria-label="Wiki navigation">{content}</nav>
      </aside>
      <details className="rounded-md border border-border-subtle bg-surface-base p-3 lg:hidden">
        <summary className="cursor-pointer text-sm font-medium leading-ui text-text-primary">
          Navigation
        </summary>
        <nav aria-label="Wiki navigation" className="mt-4">
          {content}
        </nav>
      </details>
    </>
  );
}

function WikiMediaFrame({
  zoneName,
  theme,
}: {
  zoneName: string;
  theme: WikiZoneTheme | undefined;
}) {
  const hasMedia =
    Boolean(theme?.media?.logoUnitId) ||
    Boolean(theme?.media?.bannerUnitId) ||
    Boolean(theme?.media?.backgroundUnitId);
  const initial = zoneName.trim().charAt(0).toUpperCase() || "W";

  return (
    <div
      className={
        hasMedia
          ? "min-h-36 rounded-md border border-border-subtle bg-surface-muted p-4"
          : "min-h-28 rounded-md border border-border-subtle bg-surface-muted p-4"
      }
    >
      <div className="flex h-full items-end gap-3">
        <div className="grid size-14 shrink-0 place-items-center rounded-sm bg-surface-base text-xl font-semibold leading-ui text-text-primary">
          {initial}
        </div>
        <div className="min-w-0">
          <p className="line-clamp-1 text-sm leading-ui text-text-secondary">
            {zoneName}
          </p>
        </div>
      </div>
    </div>
  );
}

function WikiHomepageSections({
  data,
  variant,
}: {
  data?: WikiZoneHomepageData | null;
  variant: WikiTemplateVariant;
}) {
  const { t } = useTranslation(["common", "entity", "search"]);
  const locale = useLocale();
  const sections = data?.sections ?? [];
  if (sections.length === 0) {
    return <EmptyState title={t("entity:realm_content_empty_title")} />;
  }

  return (
    <div className="flex flex-col gap-8">
      {sections.map(({ section, items }) => {
        if (items.length === 0 && section.emptyState === "hide") return null;
        return (
          <section key={section.id} className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-medium leading-ui text-text-primary">
                {sectionTitle(section, locale)}
              </h2>
            </div>
            {items.length === 0 ? (
              <EmptyState title={t("search:empty_title")} />
            ) : (
              <div className={gridClass(variant)}>
                {items.map((item, index) => {
                  const href = itemHref(item);
                  return (
                    <Card
                      key={`${item.kind}-${index}`}
                      surface={variant === "minimal" ? "plain" : "contained"}
                    >
                      <CardContent className="flex min-h-24 flex-col gap-2">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="line-clamp-2 text-base font-medium leading-ui text-text-primary">
                            {itemTitle(item, locale)}
                          </h3>
                          {href && (
                            <SafeLink href={href}>
                              <Button size="sm" variant="ghost">
                                {t("common:open")}
                              </Button>
                            </SafeLink>
                          )}
                        </div>
                        {itemSummary(item) && (
                          <p className="line-clamp-3 text-sm leading-body text-text-secondary">
                            {itemSummary(item)}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function WikiZoneTemplateBase({
  zone,
  homepageData,
  homepageLoading,
  onSearch,
  children,
  variant,
}: ZoneTemplateProps & { variant: WikiTemplateVariant }) {
  const { t } = useTranslation(["common", "entity", "search"]);
  const search = useSearchQuery({});
  const keywordBind = search.bind("keyword");
  const theme = zone.wiki?.theme;
  const resolvedHomepageVariant =
    homepageVariant(homepageData?.template) ?? variant;
  const contentWidth =
    theme?.layout?.contentWidth === "wide" ? "max-w-7xl" : "max-w-6xl";
  const compact = theme?.chrome?.density === "compact";
  const navPosition = theme?.chrome?.navPosition ?? "side";

  return (
    <div className="rounded-md bg-surface-base" style={zoneThemeStyle(theme)}>
      <div
        className={`mx-auto flex w-full ${contentWidth} flex-col ${
          compact ? "gap-6 p-4 md:p-6" : "gap-8 p-6 md:p-10"
        }`}
      >
        <header className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-medium uppercase tracking-normal text-text-tertiary">
              Wiki
            </p>
            <h1 className="text-3xl font-semibold leading-ui text-text-primary">
              {zone.name}
            </h1>
            {zone.description && (
              <p className="mt-3 max-w-3xl text-base leading-body text-text-secondary">
                {zone.description}
              </p>
            )}
          </div>
          {variant === "media" && (
            <div className="lg:col-span-2">
              <WikiMediaFrame zoneName={zone.name} theme={theme} />
            </div>
          )}
          <div className="min-w-0 self-end">
            <KeywordInput
              value={keywordBind.value ?? ""}
              onChange={(value) => keywordBind.onChange(value)}
              onSubmit={() => onSearch?.(search.query.keyword ?? "")}
              placeholder={t("search:zone_search_placeholder", {
                name: zone.name,
              })}
            />
          </div>
        </header>

        {navPosition === "top" && (
          <WikiNavigation navigation={zone.wiki?.navigation} placement="top" />
        )}

        <div
          className={
            navPosition === "side"
              ? "grid min-w-0 gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]"
              : "min-w-0"
          }
        >
          {navPosition === "side" && (
            <WikiNavigation navigation={zone.wiki?.navigation} />
          )}
          <main className="min-w-0">
            {homepageLoading ? (
              <div className="flex items-center gap-2 py-8 text-sm leading-ui text-text-secondary">
                <Spinner size="sm" />
                <span>{t("common:loading")}</span>
              </div>
            ) : (
              <WikiHomepageSections
                data={homepageData}
                variant={resolvedHomepageVariant}
              />
            )}
            {children ? (
              <div className="mt-8 min-w-0 overflow-x-auto">{children}</div>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}

export const WikiClassicZoneTemplate: React.FC<ZoneTemplateProps> = (props) => (
  <WikiZoneTemplateBase {...props} variant="classic" />
);

export const WikiMediaZoneTemplate: React.FC<ZoneTemplateProps> = (props) => (
  <WikiZoneTemplateBase {...props} variant="media" />
);

export const WikiDatabaseZoneTemplate: React.FC<ZoneTemplateProps> = (
  props,
) => <WikiZoneTemplateBase {...props} variant="database" />;

export const WikiMinimalZoneTemplate: React.FC<ZoneTemplateProps> = (props) => (
  <WikiZoneTemplateBase {...props} variant="minimal" />
);
