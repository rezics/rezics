import { realmMembersQuery } from "@rezics/contract/api/realm/realm";
import { unitDetailQuery } from "@rezics/contract/api/unit/unit.queries";
import { zonePortalQueryOptions } from "@rezics/contract/api/zone/zone";
import { postQueries } from "@rezics/contract/api/post/post";
import {
  mainMarkdownSource,
  type RealmDockBuiltinItem,
  type RealmDockCustomWidgetItem,
  type RealmDockItem,
  type RealmDockPlacement,
  type RealmDockWidget,
  type RealmDTO,
  type UnitDTO,
  type ZoneLinkTarget,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  CardContent,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rezics/ui/shadcn";
import { unitHref } from "@rezics/ui/primitive/link";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ExternalLink,
  Globe2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { usePinboardList } from "@/pinboard";
import { PostBodyMarkdown } from "@/post";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { AppSafeLink as SafeLink } from "@/shared/ui/link";
import { getTranslation } from "@/shared/utils/translation-helpers";
import { useMediaQuery } from "@/shared/utils/use-media-query";
import { FeaturedZoneSection } from "@/realm/sections/FeaturedZoneSection";
import { RuleSection } from "@/realm/sections/RuleSection";
import { pickZoneMenu, ZoneNavTree } from "@/zone";

interface RealmDockProps {
  realm: RealmDTO;
  placement: RealmDockPlacement;
  variant?: "rail" | "page" | "wiki";
}

/**
 * Realm Dock renderer.
 *
 * Mobile (<640px):
 * +------------------------------+
 * | Dock tab page                |
 * | [Description]                |
 * | [Subscription stat]          |
 * | [Facts] [Bookmarks]          |
 * +------------------------------+
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | Dock page full width                 |
 * | widgets stacked with readable rhythm |
 * +--------------------------------------+
 *
 * Desktop (1024-1535px):
 * +------------------+
 * | Dock side rail   |
 * | widgets stacked  |
 * +------------------+
 *
 * Ultra-wide (>=1536px):
 * +------------------+
 * | Fixed readable   |
 * | rail/page width  |
 * +------------------+
 *
 * Dock 是 realm 的產品化停靠區：main placement 在大屏作側欄、小屏作 Dock
 * tab/page；wiki placement 在 Wiki 內容之前渲染。預設標題和標籤只由 app
 * i18n 根據 kind/id 推導，payload 只保存 override 引用與配置。
 */
export function RealmDock({
  realm,
  placement,
  variant = "rail",
}: RealmDockProps) {
  const items = realm.dock?.placements[placement] ?? [];
  const labelIds = useMemo(() => collectOverrideLabelIds(items), [items]);
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

  if (items.length === 0) return null;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {items.map((item) => (
        <RealmDockItemView
          key={item.id}
          realm={realm}
          item={item}
          labels={labels}
          variant={variant}
        />
      ))}
    </div>
  );
}

function RealmDockItemView({
  realm,
  item,
  labels,
  variant,
}: {
  realm: RealmDTO;
  item: RealmDockItem;
  labels: Map<string, string>;
  variant: "rail" | "page" | "wiki";
}) {
  if (item.slot === "builtin") {
    return (
      <RealmDockBuiltinView
        realm={realm}
        item={item}
        labels={labels}
        variant={variant}
      />
    );
  }
  return (
    <RealmDockCustomWidgetView realm={realm} item={item} labels={labels} />
  );
}

function RealmDockBuiltinView({
  realm,
  item,
  labels,
  variant,
}: {
  realm: RealmDTO;
  item: RealmDockBuiltinItem;
  labels: Map<string, string>;
  variant: "rail" | "page" | "wiki";
}) {
  switch (item.id) {
    case "description":
      return <DockDescription realm={realm} item={item} variant={variant} />;
    case "subscriptionStat":
      return <DockSubscriptionStat realm={realm} item={item} labels={labels} />;
    case "realmFacts":
      return <DockRealmFacts realm={realm} />;
    case "bookmarks":
      return <DockBookmarks item={item} labels={labels} />;
    case "rules":
      return <RuleSection realmUnitId={realm.unitId} empty="hidden" />;
    case "moderators":
      return <DockModerators realmId={realm.unitId} item={item} />;
  }
}

function DockDescription({
  realm,
  item,
  variant,
}: {
  realm: RealmDTO;
  item: Extract<RealmDockBuiltinItem, { id: "description" }>;
  variant: "rail" | "page" | "wiki";
}) {
  const { t } = useTranslation("entity");
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const markdown = mainMarkdownSource(realm.description);
  if (!markdown) return null;
  const maxLines = item.maxLines ?? 4;
  const shouldOfferFullText = markdown.length > 220;
  const body = (
    <PostBodyMarkdown
      content={realm.description}
      clamp={variant === "page" && !isDesktop ? { maxLines } : false}
      className="text-sm leading-body text-text-secondary"
    />
  );

  return (
    <Card surface="contained">
      <CardContent className="p-4">
        <h2 className="text-sm font-medium leading-ui text-text-primary">
          {t("realm_dock_widget_description_title")}
        </h2>
        <div
          className={
            variant === "page" && !isDesktop
              ? "mt-2"
              : "mt-2 max-h-[8.75rem] overflow-hidden"
          }
        >
          {body}
        </div>
        {shouldOfferFullText && isDesktop ? (
          <>
            <button
              type="button"
              className="mt-2 text-left text-sm leading-ui text-link hover:underline"
              onClick={() => setOpen(true)}
            >
              {t("realm_dock_read_full_description")}
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {t("realm_dock_widget_description_title")}
                  </DialogTitle>
                </DialogHeader>
                <PostBodyMarkdown
                  content={realm.description}
                  clamp={false}
                  className="text-sm leading-body text-text-secondary"
                />
              </DialogContent>
            </Dialog>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DockSubscriptionStat({
  realm,
  item,
  labels,
}: {
  realm: RealmDTO;
  item: Extract<RealmDockBuiltinItem, { id: "subscriptionStat" }>;
  labels: Map<string, string>;
}) {
  const { t } = useTranslation("entity");
  const label = item.labelOverrideUnitId
    ? (labels.get(item.labelOverrideUnitId) ?? t("realm_dock_members"))
    : t("realm_dock_members");
  return (
    <Card surface="contained">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Users
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-text-tertiary"
          />
          <div className="min-w-0">
            <p className="text-lg font-semibold leading-ui text-text-primary">
              {formatCompactNumber(realm.memberCount ?? 0)}
            </p>
            <p className="text-sm leading-ui text-text-secondary">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DockRealmFacts({ realm }: { realm: RealmDTO }) {
  const { t } = useTranslation("entity");
  const rows = [
    realm.createdAt
      ? {
          key: "created",
          icon: CalendarDays,
          label: t("realm_dock_fact_created", {
            date: new Date(realm.createdAt).toLocaleDateString(),
          }),
        }
      : null,
    {
      key: "visibility",
      icon: Globe2,
      label: realm.isPublic
        ? t("realm_dock_fact_public")
        : t("realm_dock_fact_private"),
    },
    realm.isOfficial
      ? {
          key: "official",
          icon: ShieldCheck,
          label: t("realm_official"),
        }
      : null,
  ].flatMap((row) => (row ? [row] : []));

  if (rows.length === 0) return null;
  return (
    <Card surface="contained">
      <CardContent className="flex flex-col gap-2 p-4">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div
              key={row.key}
              className="flex min-w-0 items-center gap-2 text-sm leading-ui text-text-secondary"
            >
              <Icon aria-hidden className="size-4 shrink-0" />
              <span className="min-w-0 truncate">{row.label}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function DockBookmarks({
  item,
  labels,
}: {
  item: Extract<RealmDockBuiltinItem, { id: "bookmarks" }>;
  labels: Map<string, string>;
}) {
  const { t } = useTranslation("entity");
  if (item.items.length === 0) return null;
  return (
    <Card surface="contained">
      <CardContent className="flex flex-col gap-3 p-4">
        <h2 className="text-xs font-semibold uppercase leading-ui text-text-secondary">
          {t("realm_dock_widget_bookmarks_title")}
        </h2>
        <div className="flex flex-col gap-2">
          {item.items.map((bookmark) =>
            bookmark.kind === "group" ? (
              <DropdownMenu key={bookmark.id}>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-9 w-full justify-center gap-2 rounded-full"
                  >
                    <span className="min-w-0 truncate">
                      {labelFromOverride(
                        bookmark.labelOverrideUnitId,
                        labels,
                        t("realm_dock_bookmark_group_default"),
                      )}
                    </span>
                    <ChevronDown aria-hidden className="size-4 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="min-w-[16rem]">
                  {bookmark.items.map((link) => {
                    const href = hrefForTarget(link.target);
                    if (!href) return null;
                    return (
                      <DropdownMenuItem key={link.id} asChild>
                        <SafeLink href={href}>
                          {labelFromOverride(
                            link.labelOverrideUnitId,
                            labels,
                            t("realm_dock_bookmark_link_default"),
                          )}
                        </SafeLink>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <BookmarkButton
                key={bookmark.id}
                href={hrefForTarget(bookmark.target)}
                label={labelFromOverride(
                  bookmark.labelOverrideUnitId,
                  labels,
                  t("realm_dock_bookmark_link_default"),
                )}
              />
            ),
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function BookmarkButton({
  href,
  label,
}: {
  href: string | null;
  label: string;
}) {
  if (!href) return <DockWidgetError />;
  return (
    <SafeLink href={href}>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="h-9 w-full justify-center gap-2 rounded-full"
      >
        <span className="min-w-0 truncate">{label}</span>
        <ExternalLink aria-hidden className="size-4 shrink-0" />
      </Button>
    </SafeLink>
  );
}

function DockModerators({
  realmId,
  item,
}: {
  realmId: string;
  item: Extract<RealmDockBuiltinItem, { id: "moderators" }>;
}) {
  const { t } = useTranslation("entity");
  const limit = item.limit ?? 5;
  const query = useQuery(realmMembersQuery(realmId, { limit }));
  const moderators =
    query.data?.members.filter((member) =>
      ["owner", "admin", "moderator"].includes(member.roleKey),
    ) ?? [];

  if (query.isError) return null;
  if (moderators.length === 0) return null;

  return (
    <Card surface="contained">
      <CardContent className="flex flex-col gap-3 p-4">
        <h2 className="text-sm font-medium leading-ui text-text-primary">
          {t("realm_dock_widget_moderators_title")}
        </h2>
        <div className="flex flex-col gap-2">
          {moderators.map((member) => (
            <div
              key={member.userId}
              className="flex min-w-0 items-center gap-2"
            >
              <Avatar className="size-7">
                <AvatarImage src={member.user?.avatar ?? undefined} />
                <AvatarFallback>
                  {(member.user?.name ?? member.userId).slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium leading-ui text-text-primary">
                  {member.user?.name ?? member.user?.slug ?? member.userId}
                </p>
                <p className="truncate text-xs leading-ui text-text-secondary">
                  {member.roleKey}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RealmDockCustomWidgetView({
  realm,
  item,
  labels,
}: {
  realm: RealmDTO;
  item: RealmDockCustomWidgetItem;
  labels: Map<string, string>;
}) {
  const { t } = useTranslation("entity");
  const widget = item.widget;
  switch (widget.kind) {
    case "text":
      return (
        <DockTextWidget
          widget={widget}
          title={widgetTitle(widget, labels, t)}
        />
      );
    case "featuredZone":
      return <FeaturedZoneSection zoneUnitId={widget.zoneUnitId} />;
    case "zoneNav":
      return (
        <DockZoneNavWidget
          widget={widget}
          title={widgetTitle(widget, labels, t)}
        />
      );
    case "buttons":
      return (
        <DockButtonsWidget
          widget={widget}
          labels={labels}
          title={widgetTitle(widget, labels, t)}
        />
      );
    case "images":
      return (
        <DockImagesWidget
          widget={widget}
          labels={labels}
          title={widgetTitle(widget, labels, t)}
        />
      );
    case "communityList":
      return (
        <DockCommunityListWidget
          widget={widget}
          title={widgetTitle(widget, labels, t)}
        />
      );
    case "stats":
      return (
        <DockStatsWidget
          realm={realm}
          widget={widget}
          title={widgetTitle(widget, labels, t)}
        />
      );
    case "pinboard":
      return (
        <DockPinboardWidget
          realm={realm}
          widget={widget}
          title={widgetTitle(widget, labels, t)}
        />
      );
    case "calendar":
      return null;
  }
}

function DockTextWidget({
  widget,
  title,
}: {
  widget: Extract<RealmDockWidget, { kind: "text" }>;
  title: string;
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
  if (postQuery.isError) return <DockWidgetError />;
  if (!markdown) return null;
  return (
    <Card surface="contained">
      <CardContent className="p-4">
        <DockWidgetTitle>{title}</DockWidgetTitle>
        <PostBodyMarkdown
          content={postQuery.data.content}
          className="text-sm leading-body text-text-secondary"
        />
      </CardContent>
    </Card>
  );
}

function DockZoneNavWidget({
  widget,
  title,
}: {
  widget: Extract<RealmDockWidget, { kind: "zoneNav" }>;
  title: string;
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
  if (zoneQuery.isError) return <DockWidgetError />;
  if (!data) return null;
  const menu = pickZoneMenu(data.zone.nav, widget.menuId);
  if (!menu) return null;
  return (
    <Card surface="contained">
      <CardContent className="flex flex-col gap-3 p-4">
        <DockWidgetTitle>{title || data.zone.name}</DockWidgetTitle>
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

function DockButtonsWidget({
  widget,
  labels,
  title,
}: {
  widget: Extract<RealmDockWidget, { kind: "buttons" }>;
  labels: Map<string, string>;
  title: string;
}) {
  const { t } = useTranslation("entity");
  const items = widget.items.flatMap((item, index) => {
    const href = hrefForTarget(item.target);
    const label = labelFromOverride(
      item.labelOverrideUnitId,
      labels,
      t("realm_dock_button_default", { count: index + 1 }),
    );
    return href ? [{ href, label }] : [];
  });
  if (items.length === 0) return null;
  return (
    <Card surface="contained">
      <CardContent className="flex flex-col gap-3 p-4">
        <DockWidgetTitle>{title}</DockWidgetTitle>
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

function DockImagesWidget({
  widget,
  labels,
  title,
}: {
  widget: Extract<RealmDockWidget, { kind: "images" }>;
  labels: Map<string, string>;
  title: string;
}) {
  if (widget.items.length === 0) return null;
  return (
    <Card surface="contained">
      <CardContent className="flex flex-col gap-3 p-4">
        <DockWidgetTitle>{title}</DockWidgetTitle>
        <div className="flex flex-col gap-3">
          {widget.items.map((item) => {
            const img = (
              <img
                src={item.imageUrl}
                alt={
                  item.altOverrideUnitId
                    ? (labels.get(item.altOverrideUnitId) ?? "")
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

function DockCommunityListWidget({
  widget,
  title,
}: {
  widget: Extract<RealmDockWidget, { kind: "communityList" }>;
  title: string;
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
  const hasError = realmQueries.some((query) => query.isError);
  if (hasError && realms.length === 0) return <DockWidgetError />;
  if (realms.length === 0) return null;
  return (
    <Card surface="contained">
      <CardContent className="flex flex-col gap-3 p-4">
        <DockWidgetTitle>
          {title || t("realm_dock_widget_communityList_title")}
        </DockWidgetTitle>
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

function DockStatsWidget({
  realm,
  widget,
  title,
}: {
  realm: RealmDTO;
  widget: Extract<RealmDockWidget, { kind: "stats" }>;
  title: string;
}) {
  const { t } = useTranslation("entity");
  const items = widget.metrics.flatMap((metric) =>
    metric === "members"
      ? [{ label: t("realm_dock_members"), value: realm.memberCount }]
      : [],
  );
  if (items.length === 0) return null;
  return (
    <Card surface="contained">
      <CardContent className="flex flex-col gap-3 p-4">
        <DockWidgetTitle>
          {title || t("realm_dock_widget_stats_title")}
        </DockWidgetTitle>
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

function DockPinboardWidget({
  realm,
  widget,
  title,
}: {
  realm: RealmDTO;
  widget: Extract<RealmDockWidget, { kind: "pinboard" }>;
  title: string;
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
        <DockWidgetTitle>
          {title || t("pinboard_pinned_heading")}
        </DockWidgetTitle>
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

function DockWidgetTitle({ children }: { children: string }) {
  if (!children) return null;
  return (
    <h2 className="mb-2 text-sm font-medium leading-ui text-text-primary">
      {children}
    </h2>
  );
}

function DockWidgetError() {
  const { t } = useTranslation("entity");
  return (
    <Card surface="contained">
      <CardContent className="p-4 text-sm leading-body text-text-secondary">
        {t("realm_dock_widget_unavailable")}
      </CardContent>
    </Card>
  );
}

function collectOverrideLabelIds(items: readonly RealmDockItem[]) {
  const ids = new Set<string>();
  for (const item of items) {
    if (item.slot === "builtin") {
      if (item.id === "subscriptionStat" && item.labelOverrideUnitId) {
        ids.add(item.labelOverrideUnitId);
      }
      if (item.id === "bookmarks") {
        for (const bookmark of item.items) {
          if (bookmark.labelOverrideUnitId)
            ids.add(bookmark.labelOverrideUnitId);
          if (bookmark.kind === "group") {
            for (const link of bookmark.items) {
              if (link.labelOverrideUnitId) ids.add(link.labelOverrideUnitId);
            }
          }
        }
      }
      continue;
    }
    const widget = item.widget;
    if (widget.titleOverrideUnitId) ids.add(widget.titleOverrideUnitId);
    if (widget.kind === "buttons") {
      for (const button of widget.items) {
        if (button.labelOverrideUnitId) ids.add(button.labelOverrideUnitId);
      }
    }
    if (widget.kind === "images") {
      for (const image of widget.items) {
        if (image.altOverrideUnitId) ids.add(image.altOverrideUnitId);
      }
    }
  }
  return [...ids];
}

function widgetTitle(
  widget: RealmDockWidget,
  labels: Map<string, string>,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  return widget.titleOverrideUnitId
    ? (labels.get(widget.titleOverrideUnitId) ?? defaultWidgetTitle(widget, t))
    : defaultWidgetTitle(widget, t);
}

function defaultWidgetTitle(
  widget: RealmDockWidget,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  switch (widget.kind) {
    case "text":
      return t("realm_dock_widget_text_title");
    case "buttons":
      return t("realm_dock_widget_buttons_title");
    case "images":
      return t("realm_dock_widget_images_title");
    case "communityList":
      return t("realm_dock_widget_communityList_title");
    case "calendar":
      return t("realm_dock_widget_calendar_title");
    case "featuredZone":
      return t("realm_dock_widget_featuredZone_title");
    case "zoneNav":
      return t("realm_dock_widget_zoneNav_title");
    case "stats":
      return t("realm_dock_widget_stats_title");
    case "pinboard":
      return t("realm_dock_widget_pinboard_title");
  }
}

function labelFromOverride(
  id: string | undefined,
  labels: Map<string, string>,
  fallback: string,
) {
  return id ? (labels.get(id) ?? fallback) : fallback;
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

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
