import { Badge } from "@rezics/ui/shadcn";
import { AlertTriangle, CheckCircle2, CircleHelp, XCircle } from "lucide-react";
import { formatStatusState, type StatusState } from "../models/status";

const STATUS_ICON = {
  available: CheckCircle2,
  degraded: AlertTriangle,
  unavailable: XCircle,
  unknown: CircleHelp,
} satisfies Record<StatusState, typeof CheckCircle2>;

const STATUS_BADGE_CLASS = {
  available: "border-success-fill bg-surface-base text-success-text",
  degraded: "border-warning-fill bg-surface-base text-warning-text",
  unavailable: "border-error-fill bg-surface-base text-error-text",
  unknown: "border-border-whisper bg-surface-base text-text-secondary",
} satisfies Record<StatusState, string>;

/**
 * 狀態徽章的掃描優先級是 icon、語義色、文字；available 也必須有清楚的
 * success icon，不能只靠「可用」文字判斷。
 *
 * Mobile
 * +--------------+
 * | icon Status  |
 * +--------------+
 *
 * Tablet
 * +--------------+
 * | icon Status  |
 * +--------------+
 *
 * Desktop
 * +--------------+
 * | icon Status  |
 * +--------------+
 *
 * Ultra-wide
 * +--------------+
 * | icon Status  |
 * +--------------+
 */
export function StatusIndicator({
  status,
  compact = false,
}: {
  status: StatusState;
  compact?: boolean;
}) {
  const Icon = STATUS_ICON[status];

  return (
    <Badge
      variant="outline"
      className={`inline-flex items-center gap-1.5 ${STATUS_BADGE_CLASS[status]}`}
      aria-label={formatStatusState(status)}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {!compact && <span>{formatStatusState(status)}</span>}
    </Badge>
  );
}
