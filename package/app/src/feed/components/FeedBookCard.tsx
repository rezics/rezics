import type { FeedBookRow } from "@rezics/api/feed/feed";
import { useTranslation } from "@rezics/i18n/react";
import { Card, CardMedia } from "@rezics/ui/shadcn";
import { BookOpen } from "lucide-react";
import { AppSafeLink } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";

function bookKindLabel(kind: string, t: (key: string) => string): string {
  switch (kind) {
    case "book":
      return t("page:home_feed_type_book");
    case "game":
      return t("page:home_feed_type_game");
    case "media":
      return t("page:home_feed_type_media");
    default:
      return kind;
  }
}

interface FeedBookCardProps {
  row: FeedBookRow;
  className?: string;
}

export function FeedBookCard({ row, className }: FeedBookCardProps) {
  const { t } = useTranslation(["common", "page"]);
  const title = row.book.title ?? t("common:untitled");
  const description = row.book.description;

  return (
    <AppSafeLink
      href={row.href}
      className="block no-underline"
      aria-label={title}
    >
      <Card
        surface="plain"
        interactive
        className={cn(
          "relative w-full gap-0 py-0 transition-[background-color,box-shadow,transform] hover:-translate-y-0.5",
          className,
        )}
      >
        <article className="flex min-w-0 gap-4 p-4">
          <CardMedia className="h-28 w-18 shrink-0 rounded-sm bg-surface-subtle text-text-tertiary">
            {row.book.coverUrl ? (
              <img
                src={row.book.coverUrl}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <BookOpen className="h-5 w-5" aria-hidden />
              </div>
            )}
          </CardMedia>

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="min-w-0">
              <h3 className="m-0 line-clamp-2 text-base font-medium leading-ui text-text-primary">
                {title}
              </h3>
              {row.book.kind ? (
                <p className="mt-1 truncate text-xs leading-dense text-text-tertiary">
                  {bookKindLabel(row.book.kind, t)}
                </p>
              ) : null}
            </div>

            {description ? (
              <p className="line-clamp-3 text-sm leading-ui text-text-secondary">
                {description}
              </p>
            ) : null}
          </div>
        </article>
      </Card>
    </AppSafeLink>
  );
}
