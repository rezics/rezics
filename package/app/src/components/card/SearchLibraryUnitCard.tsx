import { Card } from "@rezics/ui/shadcn";
import { BookOpen } from "lucide-react";
import type * as React from "react";
import { Link } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";

type ClampStyle = React.CSSProperties & {
  WebkitBoxOrient?: "vertical";
  WebkitLineClamp?: number;
};

export interface SearchLibraryUnitCardProps
  extends Omit<React.ComponentProps<typeof Card>, "children" | "title"> {
  title: React.ReactNode;
  titleHref?: string;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  image?: {
    alt?: string;
    src?: string | null;
  };
  imageSlot?: React.ReactNode;
  titleLines?: number;
  descriptionLines?: number;
}

function clampStyle(lines: number): ClampStyle {
  return {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: lines,
    overflow: "hidden",
  };
}

export function SearchLibraryUnitCard({
  action,
  badge,
  className,
  description,
  descriptionLines = 3,
  image,
  imageSlot,
  interactive = true,
  meta,
  subtitle,
  surface = "plain",
  title,
  titleHref,
  titleLines = 2,
  ...props
}: SearchLibraryUnitCardProps) {
  return (
    <Card
      surface={surface}
      interactive={interactive}
      className={cn("w-full gap-0 py-0", className)}
      {...props}
    >
      <article className="flex min-w-0 gap-4 p-3">
        <div className="flex h-32 w-22 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-surface-subtle text-text-tertiary sm:h-36 sm:w-24">
          {imageSlot ??
            (image?.src ? (
              <img
                src={image.src}
                alt={image.alt ?? ""}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <BookOpen className="size-5" aria-hidden="true" />
            ))}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 py-1">
          <div className="min-w-0">
            <div className="flex min-w-0 items-start gap-2">
              <h3
                className="min-w-0 flex-1 text-base font-medium leading-ui text-text-primary"
                style={clampStyle(titleLines)}
              >
                {titleHref ? (
                  <Link
                    to={titleHref}
                    className="block min-w-0 text-text-primary no-underline underline-offset-4 decoration-current hover:underline focus-visible:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {title}
                  </Link>
                ) : (
                  title
                )}
              </h3>
              {badge ? <div className="shrink-0">{badge}</div> : null}
            </div>
            {subtitle ? (
              <div className="mt-1 truncate text-xs leading-dense text-text-secondary">
                {subtitle}
              </div>
            ) : null}
          </div>

          {description ? (
            <div
              className="text-sm leading-ui text-text-secondary"
              style={clampStyle(descriptionLines)}
            >
              {description}
            </div>
          ) : null}

          <div className="flex min-w-0 items-center justify-between gap-3">
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
      </article>
    </Card>
  );
}
