import { useTranslation } from "@rezics/i18n/react";
import { Loader2 } from "lucide-react";

import { cn } from "../../shared/lib/utils";

const SIZE_CLASS = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
} as const;

export interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  /** Accessible name. Rendered as `aria-label`; defaults to translated "Loading". */
  label?: string;
  className?: string;
}

export function Spinner({ size = "md", label, className }: SpinnerProps) {
  const { t } = useTranslation("common");
  const effectiveLabel = label ?? t("loading");
  return (
    <span
      role="status"
      aria-label={effectiveLabel}
      aria-live="polite"
      className={cn("inline-flex items-center justify-center", className)}
    >
      <Loader2
        aria-hidden="true"
        className={cn(SIZE_CLASS[size], "animate-spin text-text-secondary")}
      />
      <span className="sr-only">{effectiveLabel}</span>
    </span>
  );
}
