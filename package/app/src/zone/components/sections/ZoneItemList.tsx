import {
  useIsSubscribed,
  useSubscribeMutation,
  useUnsubscribeMutation,
} from "@rezics/api/subscription/subscription";
import {
  CATALOG_UNIT_COVER_ASPECT_RATIO_BY_TYPE,
  isCatalogUnitType,
  type UnitType,
  type ZoneSectionDisplay,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { DomainCarousel } from "@rezics/ui/composite/carousel/DomainCarousel.tsx";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  CardContent,
} from "@rezics/ui/shadcn";
import { Image as ImageIcon } from "lucide-react";
import { JoinButton } from "@/realm";
import { AppSafeLink as SafeLink } from "@/shared/ui/link";
import {
  selectHasMemberSession,
  useAuthModal,
  useAuthSessionStore,
} from "@/user";

export type ZoneListEntry = {
  key: string;
  unitId?: string | null;
  href: string;
  label: string;
  summary?: string | null;
  imageUrl?: string | null;
  type?: UnitType | string | null;
};

function isCommunityEntry(entry: ZoneListEntry): boolean {
  return entry.type === "REALM" || entry.type === "ZONE";
}

function catalogCoverAspectRatioForEntry(entry: ZoneListEntry): number {
  return entry.type && isCatalogUnitType(entry.type)
    ? CATALOG_UNIT_COVER_ASPECT_RATIO_BY_TYPE[entry.type]
    : CATALOG_UNIT_COVER_ASPECT_RATIO_BY_TYPE.BOOK;
}

function hasCatalogCoverFrame(entry: ZoneListEntry): boolean {
  return Boolean(entry.type && isCatalogUnitType(entry.type));
}

function communityInitial(label: string): string {
  return label.trim().slice(0, 1).toUpperCase() || "R";
}

function ZoneSubscriptionButton({ zoneUnitId }: { zoneUnitId: string }) {
  const { t } = useTranslation(["zone"]);
  const auth = useAuthModal("login");
  const hasMemberSession = useAuthSessionStore(selectHasMemberSession);
  const authSessionLoading = useAuthSessionStore(
    (state) => state.status === "loading",
  );
  const { data: subscription, isLoading } = useIsSubscribed(
    hasMemberSession ? zoneUnitId : "",
  );
  const subscribe = useSubscribeMutation();
  const unsubscribe = useUnsubscribeMutation();
  const isSubscribed = subscription?.subscribed === true;
  const isPending =
    authSessionLoading ||
    isLoading ||
    subscribe.isPending ||
    unsubscribe.isPending;

  const handleClick = () => {
    if (isPending) return;
    if (!hasMemberSession) {
      auth.openLogin();
      return;
    }
    if (isSubscribed) {
      unsubscribe.mutate(zoneUnitId);
    } else {
      subscribe.mutate({ subscribedUnitId: zoneUnitId });
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={isSubscribed ? "outline" : "default"}
        size="sm"
        disabled={isPending}
        onClick={handleClick}
        className="h-8 shrink-0 px-3"
      >
        {isSubscribed ? t("zone:unsubscribe") : t("zone:subscribe")}
      </Button>
      {!hasMemberSession && auth.AuthModal({})}
    </>
  );
}

function CommunityEntryAction({ entry }: { entry: ZoneListEntry }) {
  if (!entry.unitId) return null;
  if (entry.type === "REALM") {
    return <JoinButton realmId={entry.unitId} />;
  }
  if (entry.type === "ZONE") {
    return <ZoneSubscriptionButton zoneUnitId={entry.unitId} />;
  }
  return null;
}

function CommunityEntryCard({
  entry,
  className = "",
}: {
  entry: ZoneListEntry;
  className?: string;
}) {
  const { t } = useTranslation(["common"]);
  const kindLabel =
    entry.type === "ZONE" ? t("common:zone") : t("common:realm");
  const summary = entry.summary?.trim() || t("common:no_description");
  const action = <CommunityEntryAction entry={entry} />;

  return (
    <Card
      interactive
      surface="plain"
      className={`relative h-full min-h-30 cursor-pointer ${className}`}
    >
      <SafeLink
        href={entry.href}
        aria-label={entry.label}
        className="absolute inset-0 z-10 rounded-md"
      />
      <CardContent className="pointer-events-none flex h-full min-w-0 flex-col gap-3 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar className="size-11 shrink-0 rounded-md bg-surface-subtle">
            {entry.imageUrl ? (
              <AvatarImage src={entry.imageUrl} alt="" />
            ) : null}
            <AvatarFallback className="rounded-md leading-ui">
              {communityInitial(entry.label)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold leading-ui text-text-primary">
              {entry.label}
            </span>
            <span className="mt-0.5 block text-xs leading-dense text-text-tertiary">
              {kindLabel}
            </span>
          </div>
          <div className="pointer-events-auto relative z-20 shrink-0">
            {action}
          </div>
        </div>
        <span className="line-clamp-2 min-h-8 text-xs leading-dense text-text-secondary">
          {summary}
        </span>
      </CardContent>
    </Card>
  );
}

/**
 * collection/query 条目的共享布局。Mobile 为单列列表或横向 rail；Tablet
 * 起 grid 变两列；Desktop 为三列；Ultra-wide 仍由父级 max width 控制。
 * REALM/ZONE 使用等高 community card：左侧 avatar/monogram，中间标题与
 * 摘要，右侧单一 join/leave 动作；整卡仍通过 overlay link 进入详情。
 * 非 community 内容保留封面/列表形态，BOOK/GAME/MEDIA 的封面比例来自
 * catalog Unit contract。
 *
 * Mobile
 * +--------------------------------+
 * | [avatar] title            View |
 * |          description           |
 * | [cover/text item]              |
 * +--------------------------------+
 *
 * Tablet
 * +----------------+  +----------------+
 * | avatar title   |  | avatar title   |
 * | summary        |  | summary        |
 * +----------------+  +----------------+
 *
 * Desktop
 * +-------------+ +-------------+ +-------------+
 * | community   | | community   | | community   |
 * +-------------+ +-------------+ +-------------+
 *
 * Ultra-wide
 * +-------------+ +-------------+ +-------------+
 * | parent max-width keeps centered rhythm       |
 * +----------------------------------------------+
 */
export function ZoneItemList({
  entries,
  display,
}: {
  entries: ZoneListEntry[];
  display: ZoneSectionDisplay;
}) {
  if (display === "list") {
    return (
      <ul className="flex flex-col gap-2">
        {entries.map((entry) => (
          <li key={entry.key}>
            {isCommunityEntry(entry) ? (
              <CommunityEntryCard entry={entry} />
            ) : (
              <SafeLink
                href={entry.href}
                className="flex items-center gap-3 rounded-md bg-surface-subtle px-4 py-3 transition-colors hover:bg-surface-sunken"
              >
                {entry.imageUrl || hasCatalogCoverFrame(entry) ? (
                  <span
                    className={`flex shrink-0 items-center justify-center overflow-hidden rounded-sm bg-surface-sunken ${
                      hasCatalogCoverFrame(entry) ? "w-10" : "h-10 w-10"
                    }`}
                    style={
                      hasCatalogCoverFrame(entry)
                        ? {
                            aspectRatio: catalogCoverAspectRatioForEntry(entry),
                          }
                        : undefined
                    }
                  >
                    {entry.imageUrl ? (
                      <img
                        src={entry.imageUrl}
                        alt=""
                        className={`h-full w-full ${
                          hasCatalogCoverFrame(entry)
                            ? "object-fill"
                            : "object-cover"
                        }`}
                      />
                    ) : (
                      <ImageIcon
                        className="size-5 text-text-tertiary"
                        aria-hidden
                      />
                    )}
                  </span>
                ) : null}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium leading-ui text-text-primary">
                    {entry.label}
                  </span>
                  {entry.summary ? (
                    <span className="block truncate text-xs leading-dense text-text-secondary">
                      {entry.summary}
                    </span>
                  ) : null}
                </span>
              </SafeLink>
            )}
          </li>
        ))}
      </ul>
    );
  }

  if (display === "carousel" || display === "covers") {
    const isCarousel = display === "carousel";

    return (
      <DomainCarousel
        items={entries}
        itemKey={(entry) => entry.key}
        itemClassName="!basis-auto pl-4"
        showArrows={isCarousel}
        dragFree={!isCarousel}
        scrollSnap="start"
        wheelScroll
        renderItem={(entry) =>
          isCommunityEntry(entry) ? (
            <div className="w-72 sm:w-80">
              <CommunityEntryCard entry={entry} />
            </div>
          ) : (
            <div className="w-28 sm:w-32">
              <SafeLink href={entry.href} className="flex flex-col gap-2">
                <span
                  className="flex w-full items-center justify-center overflow-hidden rounded-md bg-surface-subtle"
                  style={{
                    aspectRatio: catalogCoverAspectRatioForEntry(entry),
                  }}
                >
                  {entry.imageUrl ? (
                    <img
                      src={entry.imageUrl}
                      alt=""
                      className={`h-full w-full ${
                        hasCatalogCoverFrame(entry)
                          ? "object-fill"
                          : "object-cover"
                      }`}
                    />
                  ) : (
                    <ImageIcon
                      className="size-6 text-text-tertiary"
                      aria-hidden
                    />
                  )}
                </span>
                <span className="line-clamp-2 text-xs leading-dense text-text-primary">
                  {entry.label}
                </span>
              </SafeLink>
            </div>
          )
        }
      />
    );
  }

  if (display === "avatar-wall") {
    return (
      <ul className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
        {entries.map((entry) => (
          <li key={entry.key}>
            <SafeLink
              href={entry.href}
              className="flex min-w-0 flex-col items-center gap-2 rounded-md px-2 py-3 text-center transition-colors hover:bg-surface-subtle"
            >
              <span className="flex size-16 items-center justify-center overflow-hidden rounded-full bg-surface-subtle">
                {entry.imageUrl ? (
                  <img
                    src={entry.imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon
                    className="size-5 text-text-tertiary"
                    aria-hidden
                  />
                )}
              </span>
              <span className="line-clamp-2 text-xs font-medium leading-dense text-text-primary">
                {entry.label}
              </span>
            </SafeLink>
          </li>
        ))}
      </ul>
    );
  }

  const gridClass =
    display === "featured"
      ? "grid auto-rows-fr gap-3 sm:grid-cols-2"
      : "grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3";
  return (
    <ul className={gridClass}>
      {entries.map((entry) => (
        <li key={entry.key}>
          {isCommunityEntry(entry) ? (
            <CommunityEntryCard entry={entry} />
          ) : (
            <SafeLink
              href={entry.href}
              className="flex h-full flex-col gap-1 rounded-md bg-surface-subtle px-4 py-3 transition-colors hover:bg-surface-sunken"
            >
              <span className="text-sm font-medium leading-ui text-text-primary">
                {entry.label}
              </span>
              {entry.summary ? (
                <span className="line-clamp-2 text-xs leading-dense text-text-secondary">
                  {entry.summary}
                </span>
              ) : null}
            </SafeLink>
          )}
        </li>
      ))}
    </ul>
  );
}
