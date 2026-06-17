import { contentDocMarkdownFallback } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { BookOpen } from "lucide-react";
import { useId } from "react";
import { cn } from "@/shared/utils/css-util";
import { UserHoverPreview } from "@/user";
import type { UnitCardSummary } from "../models/unitCardSummary";
import { VariantContextLink } from "./VariantContextLink";

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
  const { t } = useTranslation(["book", "entity"]);
  const titleId = useId();
  const isCompact = variant === "compact";
  const addedAt = formatAddedAt(summary.addedAt);
  const communityCatalogLabel = t("entity:community_catalog");
  const author = authorSlot ?? renderAuthor(summary, communityCatalogLabel);
  const translationMeta = renderTranslationMeta(summary, t);
  const attachments = renderAttachmentCounts(summary, t);

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
          {summary.variantContext && (
            <VariantContextLink
              context={summary.variantContext}
              className="mt-1"
            />
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
              {t("book:unit_card_added_at", { date: addedAt })}
            </time>
          )}
          {attachments && (
            <>
              {(author || addedAt) && <span aria-hidden="true">·</span>}
              <span className="min-w-0 truncate" title={attachments}>
                {attachments}
              </span>
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

function renderAuthor(summary: UnitCardSummary, communityCatalogLabel: string) {
  if (summary.isCommunityCatalog) {
    return (
      <span className="min-w-0 truncate text-text-secondary">
        {communityCatalogLabel}
      </span>
    );
  }

  if (summary.author?.unitId) {
    return (
      <UserHoverPreview
        user={{
          ...summary.author,
          description: contentDocMarkdownFallback(summary.author.description),
        }}
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

function renderAttachmentCounts(
  summary: UnitCardSummary,
  t: (key: string, options?: Record<string, unknown>) => string,
): string | null {
  const counts = summary.attachmentCounts;
  if (!counts) return null;
  const parts: string[] = [];
  if ((counts.reviews ?? 0) > 0) {
    parts.push(t("entity:unit_review_count", { count: counts.reviews }));
  }
  if ((counts.variants ?? 0) > 0) {
    parts.push(t("entity:unit_variant_count", { count: counts.variants }));
  }
  if ((counts.comments ?? 0) > 0) {
    parts.push(t("entity:unit_comment_count", { count: counts.comments }));
  }
  if ((counts.tags ?? 0) > 0) {
    parts.push(t("entity:unit_tag_count", { count: counts.tags }));
  }
  if ((counts.annotations ?? 0) > 0) {
    parts.push(
      t("entity:unit_annotation_count", { count: counts.annotations }),
    );
  }
  if (parts.length === 0 && (counts.total ?? 0) > 0) {
    parts.push(t("entity:unit_attachment_count", { count: counts.total }));
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function renderTranslationMeta(
  summary: UnitCardSummary,
  t: (key: string, options?: Record<string, unknown>) => string,
): string | null {
  const meta = summary.translationMeta;
  if (!meta) return null;
  const parts = [
    meta.language,
    meta.overrideTitle
      ? t("entity:unit_override_label", { title: meta.overrideTitle })
      : undefined,
    meta.sourceTitle
      ? t("entity:unit_source_label", { title: meta.sourceTitle })
      : undefined,
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
