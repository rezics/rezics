import type {
  Language,
  WikiZoneNavigationItem,
  WikiZoneTranslatedLabel,
  ZoneDTO,
  ZoneSection,
} from "@rezics/contract";
import { useLocale } from "@rezics/i18n/react";
import { EmptyState } from "@rezics/ui";
import { MarkdownContent } from "@rezics/ui/composite/content/MarkdownContent.tsx";
import { FeedSection } from "@/feed";
import { AppSafeLink as SafeLink } from "@/shared/ui/link";
import { zoneDetailRoute } from "../models/zoneDetailRoutes";
import { zoneHomeSections, zoneSectionPrimitive } from "../models/zoneSections";

type ConfigLink = {
  key: string;
  href: string;
  label: string;
};

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

function sectionTitle(section: ZoneSection, locale: Language) {
  return translatedLabel(section.title, locale) ?? humanizeKind(section.kind);
}

function humanizeKind(kind: string) {
  return kind.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

function navigationItemLabel(item: WikiZoneNavigationItem, locale: Language) {
  if ("label" in item) return translatedLabel(item.label, locale);
  if (item.kind === "labelHeading") return item.labelUnitId;
  if (item.kind === "entity") return item.entityId;
  if (item.kind === "tag") return item.tagUnitId;
  if (item.kind === "wikiUnit" || item.kind === "unit") return item.unitId;
  return null;
}

function navigationItemHref(item: WikiZoneNavigationItem) {
  if (item.kind === "external" || item.kind === "manualLink") return item.href;
  if (item.kind === "entity") return `/entity/${item.entityId}`;
  if (item.kind === "tag") return `/tag/${item.tagUnitId}`;
  if (item.kind === "wikiUnit") return `/unit/id/${item.unitId}`;
  if (item.kind === "unit") return `/unit/id/${item.unitId}`;
  return null;
}

function manualLinks(section: ZoneSection, locale: Language): ConfigLink[] {
  if (section.kind !== "manualLinks") return [];
  return section.links.flatMap((item) => {
    const href = navigationItemHref(item);
    const label = navigationItemLabel(item, locale);
    if (!href || !label) return [];
    return [{ key: `${section.id}:${item.kind}:${href}`, href, label }];
  });
}

function configuredLinks(section: ZoneSection, zone: ZoneDTO): ConfigLink[] {
  if (section.kind === "realmList") {
    return (section.realmUnitIds ?? []).map((unitId) => ({
      key: `${section.id}:realm:${unitId}`,
      href: `/realm/${unitId}`,
      label: unitId,
    }));
  }
  if (section.kind === "tagNavigation") {
    return [
      ...(section.tagUnitIds ?? []).map((unitId) => ({
        key: `${section.id}:tag:${unitId}`,
        href: `/tag/${unitId}`,
        label: unitId,
      })),
      ...(section.realmTagUnitIds ?? []).map((unitId) => ({
        key: `${section.id}:realm-tag:${unitId}`,
        href: `/tag/${unitId}`,
        label: unitId,
      })),
    ];
  }
  if (section.kind === "wikiCollection") {
    return (section.wikiUnitIds ?? []).map((unitId) => ({
      key: `${section.id}:wiki:${unitId}`,
      href: zoneDetailRoute({
        zoneSlug: zone.slug,
        kind: "wiki",
        unitId,
      }).href,
      label: unitId,
    }));
  }
  if (section.kind === "shelfCarousel") {
    return (section.shelfUnitIds ?? []).map((unitId) => ({
      key: `${section.id}:shelf:${unitId}`,
      href: `/shelf/${unitId}`,
      label: unitId,
    }));
  }
  return [];
}

function LinkList({ links }: { links: ConfigLink[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {links.map((link) => (
        <li key={link.key}>
          <SafeLink
            href={link.href}
            className="block rounded-md bg-surface-subtle px-4 py-3 text-sm font-medium leading-ui text-link transition-colors hover:bg-surface-sunken"
          >
            {link.label}
          </SafeLink>
        </li>
      ))}
    </ul>
  );
}

function DeferredSection({ section }: { section: ZoneSection }) {
  const locale = useLocale();
  if (section.emptyState === "hide") return null;
  return (
    <EmptyState
      title="No items yet"
      description={`${sectionTitle(section, locale)} has no visible items.`}
    />
  );
}

export function ZoneSectionRenderer({
  section,
  zone,
}: {
  section: ZoneSection;
  zone: ZoneDTO;
}) {
  const locale = useLocale();
  const primitive = zoneSectionPrimitive(section);
  if (primitive === "manualContent" && section.kind === "manualContent") {
    return <MarkdownContent content={section.body.markdown} />;
  }

  if (section.kind === "feed") {
    return (
      <FeedSection
        query={{
          scope: "zone",
          zoneUnitId: zone.unitId,
          ...(section.limit ? { limit: section.limit } : {}),
          ...(section.feedKind === "updates" ? { sort: "new" } : {}),
        }}
        emptyTitle="No feed items yet"
      />
    );
  }

  const links =
    section.kind === "manualLinks"
      ? manualLinks(section, locale)
      : configuredLinks(section, zone);

  if (primitive === "configuredLinkList" && links.length > 0) {
    return <LinkList links={links} />;
  }
  return <DeferredSection section={section} />;
}

export function ZoneSectionList({ zone }: { zone: ZoneDTO }) {
  const locale = useLocale();
  const sections = zoneHomeSections(zone);

  if (sections.length === 0) {
    return (
      <EmptyState
        title="No sections configured"
        description="This zone does not have homepage sections yet."
      />
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {sections.map((section) => (
        <section key={section.id}>
          <div className="mb-4">
            <h2 className="text-lg font-semibold leading-ui text-text-primary">
              {sectionTitle(section, locale)}
            </h2>
          </div>
          <ZoneSectionRenderer section={section} zone={zone} />
        </section>
      ))}
    </div>
  );
}
