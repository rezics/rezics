import { Badge } from "@rezics/ui/shadcn";
import { AlertTriangle, CheckCircle2, CircleHelp, XCircle } from "lucide-react";
import {
  formatStatusState,
  statusTextClass,
  type StatusState,
} from "../models/status";

const STATUS_ICON = {
  available: CheckCircle2,
  degraded: AlertTriangle,
  unavailable: XCircle,
  unknown: CircleHelp,
} satisfies Record<StatusState, typeof CheckCircle2>;

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
      className={`inline-flex items-center gap-1.5 border-border-whisper bg-surface-subtle ${statusTextClass(status)}`}
      aria-label={formatStatusState(status)}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {!compact && <span>{formatStatusState(status)}</span>}
    </Badge>
  );
}
