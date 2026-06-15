import { useTranslation } from "@rezics/i18n/react";
import {
  Badge,
  Button,
  buttonVariants,
  Card,
  CardMedia,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import {
  Trash2 as DeleteOutlineRoundedIcon,
  GripVertical as DragIndicatorRoundedIcon,
  ExternalLink as OpenInNewRoundedIcon,
  Pin as PushPinRoundedIcon,
} from "lucide-react";
import type React from "react";
import { Link, AppSafeLink as SafeLink } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";
import { resolvePinboardPinnedPreview } from "../models/pinnedEntryPreview";
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
  openHref?: string;
  onDelete?: (entry: PinboardEntryView) => void;
  /**
   * Rendered at the leading edge of the adminRow variant; intended for
   * dnd-kit drag handle wiring (listeners/attributes).
   * 渲染在 adminRow 变体的前端边缘；用于 dnd-kit 拖拽手柄的接线
   * （listeners/attributes）。
   */
  dragHandle?: React.ReactNode;
  /**
   * Warning ribbon to mark this entry as stale (underlying unit gone).
   * 警告标带，用于标记此条目已过期（底层 unit 已消失）。
   */
  stale?: boolean;
}

/**
 * Pinboard entry card variants.
 *
 * Mobile:
 * +----------------------+
 * | pinned card 78vw     |
 * | title title          |
 * | preview x 3          |
 * +----------------------+
 *
 * Tablet:
 * +----------------+  +----------------+
 * | pinned card    |  | pinned card    |
 * | image/title or |  | text preview   |
 * | text preview   |  |                |
 * +----------------+  +----------------+
 *
 * Desktop:
 * +-----------+ +-----------+ +-----------+
 * | pinned    | | pinned    | | pinned    |
 * | h-44      | | h-44      | | h-44      |
 * +-----------+ +-----------+ +-----------+
 *
 * Ultra-wide:
 * +---------+ +---------+ +---------+ +---------+
 * | pinned  | | pinned  | | pinned  | | pinned  |
 * | fixed h | | fixed h | | fixed h | | fixed h |
 * +---------+ +---------+ +---------+ +---------+
 *
 * 视觉规则：`pinned` 是读者态置顶预览。图片存在时图片为主体，只渲染标题；
 * 没有图片时渲染真实标题（若存在）与最多三行内容。语言码和其它元信息不在读者态 footer
 * 中重复出现。同行标题与图片/正文均有固定高度和截断规则，窄屏由 carousel
 * 负责横向滚动，宽屏由 item basis 控制每张卡片宽度。
 */
export const PinboardEntryCard: React.FC<PinboardEntryCardProps> = ({
  entry,
  variant = "card",
  href,
  openHref,
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
            {openHref ? (
              <Tooltip>
                <TooltipTrigger
                  render={(props) => (
                    <Link
                      {...props}
                      to={openHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        buttonVariants({ size: "icon", variant: "ghost" }),
                        props.className,
                      )}
                      aria-label={t("common:open")}
                    >
                      <OpenInNewRoundedIcon className="h-4 w-4" />
                    </Link>
                  )}
                />
                <TooltipContent>{t("common:open")}</TooltipContent>
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
                      {...props}
                      onClick={() => onDelete(entry)}
                      aria-label={t("common:delete")}
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
    const pinnedTitle = entry.title?.trim() || undefined;
    const preview = resolvePinboardPinnedPreview(entry);
    const content =
      preview.mode === "image" ? (
        <>
          <CardMedia className="h-28 bg-surface-subtle">
            <img
              src={preview.imageUrl}
              alt={pinnedTitle ?? ""}
              loading="lazy"
            />
          </CardMedia>
          {pinnedTitle ? (
            <div className="min-h-0 px-4 py-3">
              <p
                className="text-sm font-semibold leading-ui text-text-primary overflow-hidden"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {pinnedTitle}
              </p>
            </div>
          ) : null}
        </>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col p-4">
          {pinnedTitle ? (
            <p
              className="text-sm font-semibold leading-ui text-text-primary overflow-hidden"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {pinnedTitle}
            </p>
          ) : null}
          {preview.text ? (
            <p
              className={cn(
                "text-xs leading-body text-text-secondary overflow-hidden",
                pinnedTitle && "mt-2",
              )}
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
              }}
            >
              {preview.text}
            </p>
          ) : null}
        </div>
      );
    const card = (
      <Card
        surface="plain"
        interactive={Boolean(href)}
        className="h-44 gap-0 p-0"
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
