import { BookOpen } from "lucide-react";
import { useId } from "react";
import { cn } from "@/shared/utils/css-util";
import { UserHoverPreview } from "@/user/components";
import type { UnitCardSummary } from "../models/unitCardSummary";
import * as m from "@rezics/i18n/messages";

export interface UnitCardProps {
  summary: UnitCardSummary;
  variant?: "row" | "compact";
  action?: React.ReactNode;
  authorSlot?: React.ReactNode;
  className?: string;
}

export function UnitCard({
  summary,
  variant = "row",
  action,
  authorSlot,
  className,
}: UnitCardProps) {
  const titleId = useId();
  const isCompact = variant === "compact";
  const addedAt = formatAddedAt(summary.addedAt);
  const author = authorSlot ?? renderAuthor(summary);
  const translationMeta = renderTranslationMeta(summary);
  const attachments = renderAttachmentCounts(summary);

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "flex w-full min-w-0 items-stretch gap-3 rounded-md border border-border-whisper bg-surface-base px-3 py-3 text-text-primary focus-within:ring-2 focus-within:ring-border-focus",
        isCompact ? "h-20" : "h-36",
        className,
      )}
    >
      <div
        className={cn(
          "shrink-0 overflow-hidden rounded-sm bg-surface-subtle text-text-tertiary",
          isCompact ? "h-14 w-10" : "h-28 w-20",
        )}
      >
        {summary.imageUrl ? (
          <img
            src={summary.imageUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BookOpen className={isCompact ? "h-4 w-4" : "h-5 w-5"} />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-1">
        <div className="min-w-0">
          <div className="flex min-w-0 items-start gap-2">
            <h3
              id={titleId}
              className={cn(
                "min-w-0 flex-1 truncate font-medium leading-ui text-text-primary",
                isCompact ? "text-sm" : "text-base",
              )}
              title={summary.title}
            >
              {summary.title}
            </h3>
            <span className="shrink-0 rounded-full border border-border-whisper bg-surface-subtle px-2 py-0.5 text-xs leading-dense text-text-secondary">
              {summary.kind}
            </span>
          </div>
          {summary.subtitle && !isCompact && (
            <p className="truncate text-xs leading-dense text-text-secondary">
              {summary.subtitle}
            </p>
          )}
        </div>

        {!isCompact && summary.contentPreview && (
          <p className="line-clamp-3 text-sm leading-ui text-text-secondary">
            {summary.contentPreview}
          </p>
        )}

        <div className="flex min-w-0 items-center gap-2 text-xs leading-dense text-text-tertiary">
          {author}
          {author && addedAt && <span aria-hidden="true">·</span>}
          {addedAt && (
            <time dateTime={toDateTime(summary.addedAt)}>
              {m.unit_card_added_at({ date: addedAt })}
            </time>
          )}
          {attachments && (
            <>
              {(author || addedAt) && <span aria-hidden="true">·</span>}
              <span className="shrink-0">{attachments}</span>
            </>
          )}
          {!isCompact && translationMeta && (
            <>
              {(author || addedAt || attachments) && (
                <span aria-hidden="true">·</span>
              )}
              <span className="min-w-0 truncate">{translationMeta}</span>
            </>
          )}
        </div>
      </div>

      {action ? (
        <div className="flex shrink-0 items-center justify-center">
          {action}
        </div>
      ) : null}
    </article>
  );
}

function renderAuthor(summary: UnitCardSummary) {
  if (summary.isCommunityCatalog) {
    return (
      <span className="min-w-0 truncate text-text-secondary">
        Community catalog
      </span>
    );
  }

  if (summary.author?.unitId) {
    return (
      <UserHoverPreview
        user={summary.author}
        size="compact"
        className="max-w-40"
        nameClassName="max-w-28 text-text-secondary"
      />
    );
  }

  const name = summary.author?.name?.trim();
  if (!name) return null;
  return <span className="min-w-0 truncate text-text-secondary">{name}</span>;
}

function renderAttachmentCounts(summary: UnitCardSummary): string | null {
  const counts = summary.attachmentCounts;
  if (!counts) return null;
  const parts: string[] = [];
  if (counts.reviews > 0) {
    parts.push(
      `${counts.reviews} ${counts.reviews === 1 ? "review" : "reviews"}`,
    );
  }
  if (counts.tags > 0) {
    parts.push(`${counts.tags} ${counts.tags === 1 ? "tag" : "tags"}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function renderTranslationMeta(summary: UnitCardSummary): string | null {
  const meta = summary.translationMeta;
  if (!meta) return null;
  const parts = [
    meta.language,
    meta.overrideTitle ? `Override: ${meta.overrideTitle}` : undefined,
    meta.sourceTitle ? `Source: ${meta.sourceTitle}` : undefined,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : null;
}

function formatAddedAt(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function toDateTime(
  value: string | Date | null | undefined,
): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}
