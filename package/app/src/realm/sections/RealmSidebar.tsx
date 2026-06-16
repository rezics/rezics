import { unitDetailQuery } from "@rezics/api/unit/unit.queries";
import { zonePortalQueryOptions } from "@rezics/api/zone/zone";
import { postQueries } from "@rezics/api/post/post";
import {
  mainMarkdownSource,
  type RealmDTO,
  type RealmSidebarPlacement,
  type RealmSidebarWidget,
  type UnitDTO,
  type ZoneLinkTarget,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Button, Card, CardContent } from "@rezics/ui/shadcn";
import { unitHref } from "@rezics/ui/primitive/link";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useMemo } from "react";
import { usePinboardList } from "@/pinboard";
import { PostBodyMarkdown } from "@/post";
import { AppSafeLink as SafeLink } from "@/shared/ui/link";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { getTranslation } from "@/shared/utils/translation-helpers";
import { pickZoneMenu, ZoneNavTree } from "@/zone";
import { FeaturedZoneSection } from "./FeaturedZoneSection";
import { RuleSection } from "./RuleSection";

interface RealmSidebarProps {
  realm: RealmDTO;
  placement: RealmSidebarPlacement;
}

/**
 * Renders one explicit Realm.sidebar placement. The widget order is data-owned
 * and each custom short label resolves from LABEL Units; product fallback
 * headings remain normal app i18n.
 *
 * Mobile (<640px):
 * +------------------------------+
 * | Widget                       |
 * | Widget                       |
 * +------------------------------+
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | Sidebar column stacks full width     |
 * +--------------------------------------+
 *
 * Desktop (1024-1535px):
 * +------------------+
 * | 18rem sidebar    |
 * | widgets stacked  |
 * +------------------+
 *
 * Ultra-wide (>=1536px):
 * +------------------+
 * | Same fixed       |
 * | readable column  |
 * +------------------+
 *
 * 组件只负责把 placement 中的 widget 顺序渲染出来；自定义短文字一律经
 * LABEL Unit 解析，长文本经内容 Unit 解析，缺失或不可读目标按弱链接语义
 * 跳过该 widget。
 */
export function RealmSidebar({ realm, placement }: RealmSidebarProps) {
  const widgets = realm.sidebar?.placements[placement] ?? [];
  const labelIds = useMemo(() => collectLabelIds(widgets), [widgets]);
  const readContext = useReadLanguageContext();
  const labelQueries = useQueries({
    queries: labelIds.map((id) => ({
      ...unitDetailQuery(id, {
        languages: readContext.languages,
        appLocale: readContext.appLocale,
      }),
      enabled: readContext.ready,
    })),
  });
  const labels = useMemo(() => {
    const map = new Map<string, string>();
    labelIds.forEach((id, index) => {
      const unit = labelQueries[index]?.data;
      const title = unit ? unitTitle(unit) : null;
      if (title) map.set(id, title);
    });
    return map;
  }, [labelIds, labelQueries]);

  if (widgets.length === 0) return null;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {widgets.map((widget) => (
        <RealmSidebarWidgetView
          key={widget.id}
          realm={realm}
          widget={widget}
          labels={labels}
        />
      ))}
    </div>
  );
}

function RealmSidebarWidgetView({
  realm,
  widget,
  labels,
}: {
  realm: RealmDTO;
  widget: RealmSidebarWidget;
  labels: Map<string, string>;
}) {
  switch (widget.kind) {
    case "rules":
      return (
        <RuleSection
          realmUnitId={realm.unitId}
          postUnitId={realm.ruleUnitId ?? null}
          empty="hidden"
        />
      );
    case "text":
      return (
        <SidebarTextWidget
          widget={widget}
          title={widgetTitle(widget, labels)}
        />
      );
    case "featuredZone":
      return <FeaturedZoneSection zoneUnitId={widget.zoneUnitId} />;
    case "zoneNav":
      return (
        <SidebarZoneNavWidget
          widget={widget}
          title={widgetTitle(widget, labels)}
        />
      );
    case "buttons":
      return (
        <SidebarButtonsWidget
          widget={widget}
          labels={labels}
          title={widgetTitle(widget, labels)}
        />
      );
    case "images":
      return (
        <SidebarImagesWidget
          widget={widget}
          labels={labels}
          title={widgetTitle(widget, labels)}
        />
      );
    case "communityList":
      return (
        <SidebarCommunityListWidget
          widget={widget}
          title={widgetTitle(widget, labels)}
        />
      );
    case "stats":
      return (
        <SidebarStatsWidget
          realm={realm}
          widget={widget}
          title={widgetTitle(widget, labels)}
        />
      );
    case "pinboard":
      return (
        <SidebarPinboardWidget
          realm={realm}
          widget={widget}
          title={widgetTitle(widget, labels)}
        />
      );
    case "calendar":
      return null;
  }
}

function SidebarTextWidget({
  widget,
  title,
}: {
  widget: Extract<RealmSidebarWidget, { kind: "text" }>;
  title: string | null;
}) {
  const readContext = useReadLanguageContext();
  const postQuery = useQuery({
    ...postQueries.detail(widget.contentUnitId, {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    }),
    enabled: readContext.ready,
  });
  const markdown = mainMarkdownSource(postQuery.data?.content);
  if (!markdown) return null;
  return (
    <Card surface="contained">
      <CardContent className="p-4">
        {title ? (
          <h2 className="mb-2 text-sm font-medium leading-ui text-text-primary">
            {title}
          </h2>
        ) : null}
        <PostBodyMarkdown
          content={postQuery.data.content}
          className="text-sm leading-body text-text-secondary"
        />
      </CardContent>
    </Card>
  );
}

function SidebarZoneNavWidget({
  widget,
  title,
}: {
  widget: Extract<RealmSidebarWidget, { kind: "zoneNav" }>;
  title: string | null;
}) {
  const readContext = useReadLanguageContext();
  const zoneQuery = useQuery({
    ...zonePortalQueryOptions(widget.zoneUnitId, "home", {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    }),
    enabled: readContext.ready,
  });
  const data = zoneQuery.data;
  if (zoneQuery.isError || !data) return null;
  const menu = pickZoneMenu(data.zone.nav, widget.menuId);
  if (!menu) return null;
  return (
    <Card surface="contained">
      <CardContent className="flex flex-col gap-3 p-4">
        <h2 className="text-sm font-medium leading-ui text-text-primary">
          {title ?? data.zone.name}
        </h2>
        <ZoneNavTree
          menu={menu}
          zoneSlug={data.zone.slug}
          pages={data.zone.pages}
          refUnits={data.refUnits}
        />
      </CardContent>
    </Card>
  );
}

function SidebarButtonsWidget({
  widget,
  labels,
  title,
}: {
  widget: Extract<RealmSidebarWidget, { kind: "buttons" }>;
  labels: Map<string, string>;
  title: string | null;
}) {
  const items = widget.items.flatMap((item) => {
    const href = hrefForTarget(item.target);
    const label = labels.get(item.labelUnitId);
    return href && label ? [{ href, label }] : [];
  });
  if (items.length === 0) return null;
  return (
    <Card surface="contained">
      <CardContent className="flex flex-col gap-3 p-4">
        {title ? (
          <h2 className="text-sm font-medium leading-ui text-text-primary">
            {title}
          </h2>
        ) : null}
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <SafeLink key={`${item.href}:${item.label}`} href={item.href}>
              <Button size="sm" variant="secondary" className="w-full gap-2">
                <span className="min-w-0 truncate">{item.label}</span>
                <ArrowRight aria-hidden className="size-4 shrink-0" />
              </Button>
            </SafeLink>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SidebarImagesWidget({
  widget,
  labels,
  title,
}: {
  widget: Extract<RealmSidebarWidget, { kind: "images" }>;
  labels: Map<string, string>;
  title: string | null;
}) {
  if (widget.items.length === 0) return null;
  return (
    <Card surface="contained">
      <CardContent className="flex flex-col gap-3 p-4">
        {title ? (
          <h2 className="text-sm font-medium leading-ui text-text-primary">
            {title}
          </h2>
        ) : null}
        <div className="flex flex-col gap-3">
          {widget.items.map((item) => {
            const img = (
              <img
                src={item.imageUrl}
                alt={
                  item.altLabelUnitId
                    ? (labels.get(item.altLabelUnitId) ?? "")
                    : ""
                }
                className="aspect-video w-full rounded-md object-cover"
              />
            );
            const href = item.target ? hrefForTarget(item.target) : null;
            return href ? (
              <SafeLink key={item.imageUrl} href={href}>
                {img}
              </SafeLink>
            ) : (
              <div key={item.imageUrl}>{img}</div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function SidebarCommunityListWidget({
  widget,
  title,
}: {
  widget: Extract<RealmSidebarWidget, { kind: "communityList" }>;
  title: string | null;
}) {
  const { t } = useTranslation("entity");
  const readContext = useReadLanguageContext();
  const realmQueries = useQueries({
    queries: widget.realmUnitIds.map((id) => ({
      ...unitDetailQuery(id, {
        languages: readContext.languages,
        appLocale: readContext.appLocale,
      }),
      enabled: readContext.ready,
    })),
  });
  const realms = realmQueries.flatMap((query) =>
    query.data ? [query.data] : [],
  );
  if (realms.length === 0) return null;
  return (
    <Card surface="contained">
      <CardContent className="flex flex-col gap-3 p-4">
        <h2 className="text-sm font-medium leading-ui text-text-primary">
          {title ?? t("realm_sidebar_communities")}
        </h2>
        <ul className="flex flex-col gap-1">
          {realms.map((unit) => (
            <li key={unit.id}>
              <SafeLink
                href={unitHref({
                  type: unit.type,
                  unitId: unit.id,
                  slug: unit.slug,
                })}
                className="block truncate rounded-md px-2 py-1.5 text-sm leading-ui text-text-secondary transition-colors hover:bg-surface-sunken hover:text-text-primary"
              >
                {unitTitle(unit) ?? t("pinboard_entry_untitled")}
              </SafeLink>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function SidebarStatsWidget({
  realm,
  widget,
  title,
}: {
  realm: RealmDTO;
  widget: Extract<RealmSidebarWidget, { kind: "stats" }>;
  title: string | null;
}) {
  const { t } = useTranslation("entity");
  const items = widget.metrics.flatMap((metric) =>
    metric === "members"
      ? [{ label: t("realm_sidebar_members"), value: realm.memberCount }]
      : [],
  );
  if (items.length === 0) return null;
  return (
    <Card surface="contained">
      <CardContent className="flex flex-col gap-3 p-4">
        <h2 className="text-sm font-medium leading-ui text-text-primary">
          {title ?? t("realm_sidebar_stats")}
        </h2>
        <dl className="grid grid-cols-2 gap-3">
          {items.map((item) => (
            <div key={item.label}>
              <dt className="text-xs leading-dense text-text-tertiary">
                {item.label}
              </dt>
              <dd className="text-base font-medium leading-ui text-text-primary">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function SidebarPinboardWidget({
  realm,
  widget,
  title,
}: {
  realm: RealmDTO;
  widget: Extract<RealmSidebarWidget, { kind: "pinboard" }>;
  title: string | null;
}) {
  const { t } = useTranslation("entity");
  const { entries } = usePinboardList({
    realmUnitId: realm.unitId,
    pinboardKey: "home",
    enabled: widget.pinboardKey === "home",
  });
  if (widget.pinboardKey !== "home" || entries.length === 0) return null;
  return (
    <Card surface="contained">
      <CardContent className="flex flex-col gap-3 p-4">
        <h2 className="text-sm font-medium leading-ui text-text-primary">
          {title ?? t("pinboard_pinned_heading")}
        </h2>
        <ul className="flex flex-col gap-1">
          {entries.slice(0, 5).map((entry) => (
            <li key={entry.unitId}>
              <SafeLink
                href={`/unit/${entry.unitId}`}
                className="block truncate rounded-md px-2 py-1.5 text-sm leading-ui text-text-secondary transition-colors hover:bg-surface-sunken hover:text-text-primary"
              >
                {entry.title ?? t("pinboard_entry_untitled")}
              </SafeLink>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function collectLabelIds(widgets: readonly RealmSidebarWidget[]) {
  const ids = new Set<string>();
  for (const widget of widgets) {
    if (widget.titleLabelUnitId) ids.add(widget.titleLabelUnitId);
    if (widget.kind === "buttons") {
      for (const item of widget.items) ids.add(item.labelUnitId);
    }
    if (widget.kind === "images") {
      for (const item of widget.items) {
        if (item.altLabelUnitId) ids.add(item.altLabelUnitId);
      }
    }
  }
  return [...ids];
}

function widgetTitle(
  widget: RealmSidebarWidget,
  labels: Map<string, string>,
): string | null {
  return widget.titleLabelUnitId
    ? (labels.get(widget.titleLabelUnitId) ?? null)
    : null;
}

function unitTitle(unit: UnitDTO): string | null {
  return (
    unit.title ?? getTranslation(unit.translations)?.title ?? unit.slug ?? null
  );
}

function hrefForTarget(target: ZoneLinkTarget): string | null {
  if (target.kind === "external") return target.url;
  if (target.kind === "unit") return `/unit/${target.unitId}`;
  return null;
}
