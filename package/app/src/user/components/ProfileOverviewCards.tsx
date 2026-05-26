import type { ContentSearchDocument } from "@rezics/contract";
import { Card } from "@rezics/ui/shadcn";
import type { FC } from "react";
import { Link } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";

function resolveOverviewTitle(
  item: ContentSearchDocument,
  untitledLabel: string,
): string {
  return (
    item.translations?.find((translation) => translation.title)?.title ??
    item.titles.find((title) => title.trim() !== "") ??
    item.type ??
    untitledLabel
  );
}

function firstText(
  ...values: Array<readonly string[] | string | null | undefined>
): string {
  for (const value of values) {
    if (Array.isArray(value)) {
      const found = value.find((entry) => entry.trim() !== "");
      if (found) return found;
      continue;
    }
    if (value && value.trim() !== "") return value;
  }
  return "";
}

export const ProfileStatLink: FC<{
  className?: string;
  count: number | undefined;
  label: string;
  to: string;
  variant?: "compact" | "row";
}> = ({ className, count, label, to, variant = "row" }) => (
  <Link to={to} className="block no-underline">
    <Card
      surface="plain"
      interactive
      size="sm"
      className={cn("gap-0 py-0", className)}
      aria-label={`${label}: ${count ?? "-"}`}
    >
      <span
        className={cn(
          "flex min-w-0 items-center gap-2 p-2 text-sm leading-ui",
          variant === "row"
            ? "justify-between"
            : "flex-col items-start justify-center",
        )}
      >
        <strong className="text-base font-medium leading-ui text-text-primary">
          {count ?? "-"}
        </strong>
        <span className="min-w-0 truncate text-text-secondary">{label}</span>
      </span>
    </Card>
  </Link>
);

export const ProfilePinnedItemCard: FC<{
  item: ContentSearchDocument;
  untitledLabel: string;
}> = ({ item, untitledLabel }) => {
  const title = resolveOverviewTitle(item, untitledLabel);
  const summary = firstText(item.summaries, item.descriptionText);

  return (
    <Link
      to="/unit/$unitId"
      params={{ unitId: item.id }}
      search={{ view: "auto" }}
      className="block h-full no-underline"
    >
      <Card surface="plain" interactive className="h-full gap-0 py-0">
        <article className="flex h-full min-w-0 flex-col gap-2 p-3">
          <span className="text-xs uppercase leading-dense text-text-tertiary">
            {item.type}
          </span>
          <span className="line-clamp-2 text-sm font-medium leading-ui text-text-primary">
            {title}
          </span>
          {summary ? (
            <span className="line-clamp-2 text-xs leading-ui text-text-secondary">
              {summary}
            </span>
          ) : null}
        </article>
      </Card>
    </Link>
  );
};

export const ProfileActivityCard: FC<{
  dateLabel?: string;
  item: ContentSearchDocument;
  untitledLabel: string;
}> = ({ dateLabel, item, untitledLabel }) => {
  const title = resolveOverviewTitle(item, untitledLabel);

  return (
    <Card surface="plain" size="sm" className="gap-0 py-0">
      <article className="flex min-w-0 items-center gap-3 p-2">
        <span className="basis-16 shrink-0 truncate text-xs uppercase leading-dense text-text-tertiary">
          {item.type}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm leading-ui text-text-primary">
          {title}
        </span>
        {dateLabel ? (
          <span className="shrink-0 text-xs leading-dense text-text-secondary">
            {dateLabel}
          </span>
        ) : null}
      </article>
    </Card>
  );
};
