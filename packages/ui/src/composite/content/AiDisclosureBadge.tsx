import type { AiDisclosureMode } from "@rezics/contract";
import { Badge } from "#/shadcn/badge";

const DEFAULT_AI_DISCLOSURE_LABELS: Record<AiDisclosureMode, string> = {
  UNKNOWN: "Unknown",
  NONE: "No AI use",
  AI_ASSISTED: "AI-assisted",
  AI_ORIGINATED: "AI-originated",
  MACHINE_GENERATED: "Machine-generated",
};

const AI_DISCLOSURE_TINT: Record<AiDisclosureMode, string> = {
  UNKNOWN: "",
  NONE: "text-success-text border-success-fill/40",
  AI_ASSISTED: "text-info-text border-info-fill/40",
  AI_ORIGINATED: "text-warning-text border-warning-fill/40",
  MACHINE_GENERATED: "text-warning-text border-warning-fill/40",
};

export interface AiDisclosureBadgeProps {
  mode: AiDisclosureMode;
  label?: string;
}

export function AiDisclosureBadge({ mode, label }: AiDisclosureBadgeProps) {
  return (
    <Badge variant="outline" className={AI_DISCLOSURE_TINT[mode]}>
      {label ?? DEFAULT_AI_DISCLOSURE_LABELS[mode]}
    </Badge>
  );
}
