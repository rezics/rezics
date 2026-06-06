import { Avatar, AvatarFallback, AvatarImage, Card } from "@rezics/ui/shadcn";
import { FileText } from "lucide-react";
import type * as React from "react";
import { Link } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";
import { UserHoverPreview, type UserHoverPreviewUser } from "@/user/components";

type ClampStyle = React.CSSProperties & {
  WebkitBoxOrient?: "vertical";
  WebkitLineClamp?: number;
};

export interface SearchContentResultCardProps
  extends Omit<React.ComponentProps<typeof Card>, "children" | "title"> {
  user?: UserHoverPreviewUser;
  author?: React.ReactNode;
  time?: React.ReactNode;
  kind?: React.ReactNode;
  source?: React.ReactNode;
  sourceHref?: string;
  avatar?: {
    alt?: string;
    fallback?: React.ReactNode;
    src?: string | null;
  };
  avatarSlot?: React.ReactNode;
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  titleHref?: string;
  body?: React.ReactNode;
  meta?: React.ReactNode;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  thumbnail?: {
    alt?: string;
    src?: string | null;
  };
  thumbnailSlot?: React.ReactNode;
  titleLines?: number;
  bodyLines?: number;
}

function clampStyle(lines: number): ClampStyle {
  return {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: lines,
    overflow: "hidden",
  };
}

export function SearchContentResultCard({
  action,
  author,
  avatar,
  avatarSlot,
  badge,
  body,
  bodyLines = 4,
  className,
  eyebrow,
  interactive = true,
  kind,
  meta,
  source,
  sourceHref,
  surface = "plain",
  thumbnail,
  thumbnailSlot,
  time,
  title,
  titleHref,
  titleLines = 2,
  user,
  ...props
}: SearchContentResultCardProps) {
  const hasMedia = Boolean(thumbnailSlot || thumbnail?.src);
  const hasUser = Boolean(user?.unitId);
  const hasAvatar = Boolean(
    hasUser || avatarSlot || avatar?.src || avatar?.fallback,
  );
  const hasPrimaryMeta = Boolean(hasUser || author || time || eyebrow);
  const hasContextMeta = Boolean(kind || source || badge);
  const hasHeader = hasAvatar || hasPrimaryMeta || hasContextMeta;

  return (
    <Card
      surface={surface}
      interactive={interactive}
      className={cn("w-full gap-0 py-0", className)}
      {...props}
    >
      <article className="flex min-w-0 gap-4 p-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {hasHeader ? (
            <div className="flex min-w-0 gap-3">
              {hasAvatar ? (
                <div className="shrink-0 pt-0.5">
                  {hasUser && user ? (
                    <UserHoverPreview
                      user={user}
                      size="compact"
                      showName={false}
                      avatarClassName="size-8"
                    />
                  ) : (
                    (avatarSlot ?? (
                      <Avatar className="size-8">
                        {avatar?.src ? (
                          <AvatarImage
                            src={avatar.src}
                            alt={avatar.alt ?? ""}
                          />
                        ) : null}
                        <AvatarFallback>
                          {avatar?.fallback ?? "?"}
                        </AvatarFallback>
                      </Avatar>
                    ))
                  )}
                </div>
              ) : null}

              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                {hasPrimaryMeta ? (
                  <div className="flex min-w-0 items-center gap-1.5 text-xs leading-dense">
                    {hasUser && user ? (
                      <UserHoverPreview
                        user={user}
                        size="compact"
                        showAvatar={false}
                        nameClassName="inline-block min-w-0 truncate font-medium hover:[box-shadow:inset_0_-1px_0_currentColor] focus-visible:[box-shadow:inset_0_-1px_0_currentColor]"
                      />
                    ) : author ? (
                      <span className="min-w-0 truncate font-medium text-text-primary">
                        {author}
                      </span>
                    ) : eyebrow ? (
                      <span className="min-w-0 truncate text-text-tertiary">
                        {eyebrow}
                      </span>
                    ) : null}
                    {time ? (
                      <>
                        {hasUser || author || eyebrow ? (
                          <span className="shrink-0 text-text-tertiary">·</span>
                        ) : null}
                        <span className="shrink-0 text-text-tertiary">
                          {time}
                        </span>
                      </>
                    ) : null}
                  </div>
                ) : null}

                {hasContextMeta ? (
                  <div className="flex min-w-0 items-center gap-1.5 text-xs leading-dense text-text-tertiary">
                    {badge ? (
                      <span className="shrink-0">{badge}</span>
                    ) : kind ? (
                      <span className="shrink-0 text-text-secondary">
                        {kind}
                      </span>
                    ) : null}
                    {source ? (
                      <>
                        {kind || badge ? (
                          <span className="shrink-0 text-text-tertiary">·</span>
                        ) : null}
                        {sourceHref ? (
                          <Link
                            to={sourceHref}
                            className="inline-block min-w-0 max-w-full truncate text-text-tertiary no-underline hover:[box-shadow:inset_0_-1px_0_currentColor] focus-visible:[box-shadow:inset_0_-1px_0_currentColor]"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {source}
                          </Link>
                        ) : (
                          <span className="min-w-0 truncate">{source}</span>
                        )}
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {title ? (
            <h3
              className="text-base font-medium leading-ui text-text-primary"
              style={clampStyle(titleLines)}
            >
              {titleHref ? (
                <Link
                  to={titleHref}
                  className="block text-text-primary no-underline underline-offset-4 decoration-current"
                  onClick={(event) => event.stopPropagation()}
                >
                  {title}
                </Link>
              ) : (
                title
              )}
            </h3>
          ) : null}

          {body ? (
            <div
              className={cn(
                "text-sm leading-ui",
                title ? "text-text-secondary" : "text-text-primary",
              )}
              style={clampStyle(bodyLines)}
            >
              {body}
            </div>
          ) : null}

          <div className="flex min-w-0 items-center justify-between gap-3 pt-1">
            {meta ? (
              <div className="min-w-0 truncate text-xs leading-dense text-text-tertiary">
                {meta}
              </div>
            ) : (
              <span aria-hidden="true" />
            )}
            {action ? <div className="shrink-0">{action}</div> : null}
          </div>
        </div>

        {hasMedia ? (
          <div className="hidden h-22 w-30 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-surface-subtle text-text-tertiary sm:flex">
            {thumbnailSlot ??
              (thumbnail?.src ? (
                <img
                  src={thumbnail.src}
                  alt={thumbnail.alt ?? ""}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <FileText className="size-5" aria-hidden="true" />
              ))}
          </div>
        ) : null}
      </article>
    </Card>
  );
}
