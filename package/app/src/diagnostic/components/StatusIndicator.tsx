import type { StatusState } from "@rezics/api";
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { formatStatusState } from "../models/status";

const STATUS_CLASS: Record<StatusState, string> = {
  available: "text-success-text bg-success-fill/10",
  degraded: "text-warning-text bg-warning-fill/10",
  unavailable: "text-error-text bg-error-fill/10",
  unknown: "text-text-secondary bg-surface-subtle",
};

const STATUS_ICON: Record<StatusState, LucideIcon> = {
  available: CheckCircle2,
  degraded: AlertTriangle,
  unavailable: XCircle,
  unknown: CircleHelp,
};

export function StatusIndicator({ status }: { status: StatusState }) {
  const Icon = STATUS_ICON[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium leading-[1.3] ${STATUS_CLASS[status]}`}
      aria-label={formatStatusState(status)}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {formatStatusState(status)}
    </span>
  );
}
