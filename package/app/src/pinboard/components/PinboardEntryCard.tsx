import { useTranslation } from "@rezics/i18n/react";
import {
  Badge,
  Button,
  Card,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import {
  Trash2 as DeleteOutlineRoundedIcon,
  GripVertical as DragIndicatorRoundedIcon,
  Pencil as EditRoundedIcon,
  Pin as PushPinRoundedIcon,
} from "lucide-react";
import type React from "react";
import { cn } from "@/shared/utils/css-util";
import { AppSafeLink as SafeLink } from "@/shared/ui/link";
import type { PinboardEntryView } from "../models/types";

export type PinboardEntryCardVariant =
  | "compact"
  | "card"
  | "pinned"
  | "adminRow";

export interface PinboardEntryCardProps {
  entry: PinboardEntryView;
  variant?: PinboardEntryCardVariant;
  href?: string;
  onEdit?: (entry: PinboardEntryView) => void;
  onDelete?: (entry: PinboardEntryView) => void;
  /**
   * Rendered at the leading edge of the adminRow variant; intended for
   * dnd-kit drag handle wiring (listeners/attributes).
   */
  dragHandle?: React.ReactNode;
  /** Warning ribbon to mark this entry as stale (underlying unit gone). */
  stale?: boolean;
}

export const PinboardEntryCard: React.FC<PinboardEntryCardProps> = ({
  entry,
  variant = "card",
  href,
  onEdit,
  onDelete,
  dragHandle,
  stale,
}) => {
  const { t } = useTranslation(["common", "entity"]);
  const title = entry.title ?? t("entity:pinboard_entry_untitled");
  const summary = entry.summary ?? undefined;

  if (variant === "compact") {
    const content = (
      <>
        <PushPinRoundedIcon
          className="h-3.5 w-3.5 text-warning-text shrink-0"
          aria-hidden="true"
        />
        <span className="text-sm whitespace-nowrap overflow-hidden text-ellipsis min-w-0 flex-1">
          {title}
        </span>
      </>
    );

    if (href) {
      return (
        <SafeLink
          href={href}
          className="flex flex-row items-center gap-2 min-w-0 flex-1 text-inherit no-underline"
        >
          {content}
        </SafeLink>
      );
    }

    return (
      <div className="flex flex-row items-center gap-2 min-w-0 flex-1">
        {content}
      </div>
    );
  }

  if (variant === "adminRow") {
    return (
      <div
        className={cn(
          "flex flex-row items-center gap-3 py-2 px-3 rounded-md border border-border-whisper bg-surface-elevated",
          stale && "opacity-75 bg-surface-subtle",
        )}
      >
        {dragHandle ?? (
          <DragIndicatorRoundedIcon
            className="h-5 w-5 text-text-secondary"
            aria-hidden="true"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-row items-center gap-2">
            <p className="text-sm font-semibold truncate min-w-0">{title}</p>
            {stale ? (
              <Badge
                variant="outline"
                className="border-warning-fill text-warning-text"
              >
                {t("entity:pinboard_entry_stale")}
              </Badge>
            ) : null}
            <Badge
              variant="outline"
              aria-label={t("entity:pinboard_entry_language", {
                lang: entry.language,
              })}
            >
              {entry.language}
            </Badge>
          </div>
          {summary ? (
            <p className="block text-xs text-text-secondary truncate">
              {summary}
            </p>
          ) : null}
        </div>
        <TooltipProvider>
          <div className="flex flex-row gap-1">
            {onEdit ? (
              <Tooltip>
                <TooltipTrigger
                  render={(props) => (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onEdit(entry)}
                      aria-label={t("common:edit")}
                      {...props}
                    >
                      <EditRoundedIcon className="h-4 w-4" />
                    </Button>
                  )}
                />
                <TooltipContent>{t("common:edit")}</TooltipContent>
              </Tooltip>
            ) : null}
            {onDelete ? (
              <Tooltip>
                <TooltipTrigger
                  render={(props) => (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-error-text"
                      onClick={() => onDelete(entry)}
                      aria-label={t("common:delete")}
                      {...props}
                    >
                      <DeleteOutlineRoundedIcon className="h-4 w-4" />
                    </Button>
                  )}
                />
                <TooltipContent>{t("common:delete")}</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        </TooltipProvider>
      </div>
    );
  }

  if (variant === "pinned") {
    const content = (
      <>
        <p
          className="text-sm font-semibold leading-ui text-text-primary overflow-hidden"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {title}
        </p>
        {summary ? (
          <p
            className="mt-1 text-xs leading-dense text-text-secondary overflow-hidden"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {summary}
          </p>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="truncate text-xs leading-dense text-text-tertiary">
            {entry.subtitle ?? entry.language}
          </span>
          <span
            className="shrink-0 text-xs leading-dense text-text-tertiary"
            aria-label={t("entity:pinboard_entry_language", {
              lang: entry.language,
            })}
          >
            {entry.language}
          </span>
        </div>
      </>
    );
    const card = (
      <Card
        surface="plain"
        interactive={Boolean(href)}
        className="min-h-28 gap-0 p-4"
      >
        {content}
      </Card>
    );

    if (href) {
      return (
        <SafeLink href={href} className="block text-inherit no-underline">
          {card}
        </SafeLink>
      );
    }

    return card;
  }

  const content = (
    <>
      <div className="flex flex-row items-center gap-2 mb-1">
        <PushPinRoundedIcon
          className="h-4 w-4 text-warning-text shrink-0"
          aria-hidden="true"
        />
        <p className="text-sm font-semibold truncate">{title}</p>
      </div>
      {summary ? (
        <p
          className="text-sm text-text-secondary overflow-hidden"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {summary}
        </p>
      ) : null}
    </>
  );
  const card = (
    <Card surface="plain" interactive={Boolean(href)} className="gap-0 p-4">
      {content}
    </Card>
  );

  if (href) {
    return (
      <SafeLink href={href} className="block text-inherit no-underline">
        {card}
      </SafeLink>
    );
  }

  return card;
};
