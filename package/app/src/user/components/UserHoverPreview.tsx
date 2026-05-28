import { type ReactiveMessageBag, useTranslation } from "@rezics/i18n/react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
  Separator,
} from "@rezics/ui/shadcn";
import { useId, useState } from "react";
import { FollowButton } from "@/engagement/components/FollowButton";
import { Link, unitHref } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";

type UserHoverMessages = ReactiveMessageBag<typeof i18nMessages>;

export type UserHoverPreviewSize = "compact" | "default";

export interface UserHoverPreviewUser {
  unitId: string;
  slug?: string | null;
  name?: string | null;
  avatar?: string | null;
  bio?: string | null;
  description?: string | null;
  followersCount?: number | null;
  followingsCount?: number | null;
  isFollowing?: boolean | null;
}

export interface UserHoverPreviewProps {
  user: UserHoverPreviewUser;
  size?: UserHoverPreviewSize;
  className?: string;
  avatarClassName?: string;
  nameClassName?: string;
  contentClassName?: string;
  showAvatar?: boolean;
  showName?: boolean;
  defaultOpen?: boolean;
}

const hoverDelay = 120;
const hoverCloseDelay = 80;

export function UserHoverPreview({
  user,
  size = "default",
  className,
  avatarClassName,
  nameClassName,
  contentClassName,
  showAvatar = true,
  showName = true,
  defaultOpen = false,
}: UserHoverPreviewProps) {
  const { t } = useTranslation(["settings"]);
const idPrefix = useId();
  const userId = getOptionalText(user.unitId);
  const slug = getOptionalText(user.slug);
  const displayName = getOptionalText(user.name) ?? slug ?? "Reader";
  const profileText =
    getOptionalText(user.bio) ?? getOptionalText(user.description);
  const avatarFallback = getAvatarFallback(displayName, slug, userId);
  const avatarTriggerId = `${idPrefix}-avatar`;
  const nameTriggerId = `${idPrefix}-name`;
  const [open, setOpen] = useState(defaultOpen);
  const [triggerId, setTriggerId] = useState<string | null>(
    defaultOpen ? avatarTriggerId : null,
  );

  if (!userId) {
    return (
      <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
        {showAvatar ? (
          <PreviewAvatar
            avatar={user.avatar}
            displayName={displayName}
            fallback={avatarFallback}
            size={size}
            className={avatarClassName}
          />
        ) : null}
        {showName ? (
          <span
            className={cn(
              "min-w-0 truncate text-text-primary",
              getNameClassName(size),
              nameClassName,
            )}
          >
            {displayName}
          </span>
        ) : null}
      </span>
    );
  }

  const stats = getStats(user, m);
  const profileHref = unitHref({
    type: "USER",
    unitId: userId,
    slug: slug ?? null,
  });
  const openFromTriggerFocus = (nextTriggerId: string) => {
    setTriggerId(nextTriggerId);
    setOpen(true);
  };
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setTriggerId(null);
    }
  };

  return (
    <Popover open={open} triggerId={triggerId} onOpenChange={handleOpenChange}>
      <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
        {showAvatar ? (
          <PopoverTrigger
            id={avatarTriggerId}
            openOnHover
            delay={hoverDelay}
            closeDelay={hoverCloseDelay}
            onFocus={() => openFromTriggerFocus(avatarTriggerId)}
            onMouseEnter={() => setTriggerId(avatarTriggerId)}
            render={
              <Link
                to={profileHref}
                aria-label={`Open ${displayName}'s profile`}
                className="inline-flex shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              />
            }
          >
            <PreviewAvatar
              avatar={user.avatar}
              displayName={displayName}
              fallback={avatarFallback}
              size={size}
              className={avatarClassName}
            />
          </PopoverTrigger>
        ) : null}

        {showName ? (
          <PopoverTrigger
            id={nameTriggerId}
            openOnHover
            delay={hoverDelay}
            closeDelay={hoverCloseDelay}
            onFocus={() => openFromTriggerFocus(nameTriggerId)}
            onMouseEnter={() => setTriggerId(nameTriggerId)}
            render={
              <Link
                to={profileHref}
                className={cn(
                  "inline-flex min-w-0 max-w-48 items-center truncate text-text-primary no-underline underline-offset-4 outline-none hover:underline focus-visible:underline focus-visible:ring-2 focus-visible:ring-ring/30",
                  getNameClassName(size),
                  nameClassName,
                )}
              />
            }
          >
            {displayName}
          </PopoverTrigger>
        ) : null}
      </span>

      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={8}
        style={{
          backgroundColor: "var(--colors-surface-elevated)",
          borderColor: "var(--colors-border-whisper)",
          color: "var(--colors-text-primary)",
        }}
        className={cn(
          "w-72 gap-3 rounded-lg border border-border-whisper bg-surface-elevated p-4 text-text-primary shadow-none ring-0",
          contentClassName,
        )}
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <Link
            to={profileHref}
            aria-label={`Open ${displayName}'s profile`}
            className="inline-flex shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <PreviewAvatar
              avatar={user.avatar}
              displayName={displayName}
              fallback={avatarFallback}
              size="default"
              className="size-12 text-base"
            />
          </Link>
          <FollowButton
            userId={userId}
            initialIsFollowing={user.isFollowing ?? undefined}
            initialFollowersCount={user.followersCount ?? undefined}
            size="sm"
            variant="default"
            className="shrink-0"
          />
        </div>

        <div className="min-w-0">
          <PopoverTitle className="truncate text-base font-medium leading-ui text-text-primary">
            <Link
              to={profileHref}
              className="block truncate text-text-primary no-underline underline-offset-4 outline-none hover:underline focus-visible:underline focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              {displayName}
            </Link>
          </PopoverTitle>
          {slug && (
            <PopoverDescription className="truncate text-sm leading-ui text-text-secondary">
              <Link
                to={profileHref}
                className="block truncate text-text-secondary no-underline underline-offset-4 outline-none hover:underline focus-visible:underline focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                @{slug}
              </Link>
            </PopoverDescription>
          )}
        </div>

        {profileText && (
          <p className="line-clamp-3 text-sm leading-body text-text-secondary">
            {profileText}
          </p>
        )}

        {stats.length > 0 && (
          <>
            <Separator className="bg-border-whisper" />
            <dl className="flex flex-wrap items-center gap-4 text-xs leading-dense text-text-secondary">
              {stats.map((stat) => (
                <div key={stat.label} className="flex items-baseline gap-1">
                  <dt className="font-medium text-text-primary">
                    {formatCount(stat.value)}
                  </dt>
                  <dd>{stat.label}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface PreviewAvatarProps {
  avatar?: string | null;
  displayName: string;
  fallback: string;
  size: UserHoverPreviewSize;
  className?: string;
}

function PreviewAvatar({
  avatar,
  displayName,
  fallback,
  size,
  className,
}: PreviewAvatarProps) {
  return (
    <Avatar
      className={cn(
        "rounded-md",
        size === "compact" ? "size-8" : "size-9",
        className,
      )}
    >
      <AvatarImage src={avatar ?? undefined} alt={`${displayName} avatar`} />
      <AvatarFallback>{fallback}</AvatarFallback>
    </Avatar>
  );
}

function getOptionalText(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : undefined;
}

function getNameClassName(size: UserHoverPreviewSize) {
  return size === "compact"
    ? "text-xs font-semibold leading-dense"
    : "text-sm font-semibold leading-ui";
}

function getAvatarFallback(
  displayName: string,
  slug: string | undefined,
  userId: string | undefined,
) {
  const source = displayName || slug || userId || "?";
  const parts = source.trim().split(/\s+/).filter(Boolean);
  const fallback =
    parts.length > 1
      ? `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`
      : (parts[0] ?? "?").slice(0, 2);

  return fallback.toUpperCase();
}

function getStats(user: UserHoverPreviewUser, m: UserHoverMessages) {
  return [
    { label: t("settings:profile_tab_followers"), value: user.followersCount },
    { label: t("settings:profile_following"), value: user.followingsCount },
  ]
    .filter((stat) => typeof stat.value === "number")
    .map((stat) => ({ label: stat.label, value: stat.value ?? 0 }));
}

function formatCount(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  }).format(value);
}
