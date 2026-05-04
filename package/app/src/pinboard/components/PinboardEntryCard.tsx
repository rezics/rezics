import { Badge, Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@rezics/ui/shadcn";
import type React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/css-util";
import type { PinboardEntryView } from "../models/types";
import { Trash2 as DeleteOutlineRoundedIcon, GripVertical as DragIndicatorRoundedIcon, Pencil as EditRoundedIcon, Pin as PushPinRoundedIcon } from "lucide-react";

export type PinboardEntryCardVariant = "compact" | "card" | "adminRow";

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
  const { t } = useTranslation();
  const title = entry.title ?? t("pinboard.entry.untitled");
  const summary = entry.summary ?? undefined;

  if (variant === "compact") {
    const Wrapper = (href ? "a" : "span") as "a" | "span";
    return (
      <div className="flex flex-row items-center gap-2 min-w-0 flex-1">
        <PushPinRoundedIcon
          className="h-3.5 w-3.5 text-warning-text shrink-0"
          aria-hidden="true"
        />
        <Wrapper
          className="text-sm whitespace-nowrap overflow-hidden text-ellipsis min-w-0 flex-1"
          {...(href ? { href } : {})}
        >
          {title}
        </Wrapper>
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
              <Badge variant="outline" className="border-warning-fill text-warning-text">
                {t("pinboard.entry.stale")}
              </Badge>
            ) : null}
            <Badge
              variant="outline"
              aria-label={t("pinboard.entry.language", {
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
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onEdit(entry)}
                    aria-label={t("common.edit")}
                  >
                    <EditRoundedIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("common.edit")}</TooltipContent>
              </Tooltip>
            ) : null}
            {onDelete ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-error-text"
                    onClick={() => onDelete(entry)}
                    aria-label={t("common.delete")}
                  >
                    <DeleteOutlineRoundedIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("common.delete")}</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        </TooltipProvider>
      </div>
    );
  }

  const Wrapper = (href ? "a" : "div") as "a" | "div";
  return (
    <Wrapper
      {...(href ? { href } : {})}
      className={cn(
        "block no-underline text-inherit p-4 rounded-lg border border-border-whisper bg-surface-elevated transition-colors",
        href && "hover:border-brand-fill/60",
      )}
    >
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
    </Wrapper>
  );
};
