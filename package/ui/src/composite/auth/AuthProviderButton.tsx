import type { FC, ReactNode } from "react";
import { Spinner } from "../../primitive/feedback/Spinner";
import { cn } from "../../shared/lib/utils";

interface AuthProviderButtonProps {
  label: string;
  icon?: ReactNode;
  compact?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export const AuthProviderButton: FC<AuthProviderButtonProps> = ({
  label,
  icon,
  compact = false,
  loading = false,
  disabled = false,
  onClick,
}) => {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      aria-label={label}
      className={cn(
        "relative inline-flex w-full items-center justify-center",
        "rounded-md border transition-colors",
        "border-border-whisper",
        "bg-surface-canvas",
        "text-text-primary",
        "hover:border-brand-fill",
        "hover:bg-surface-elevated",
        "active:border-brand-fill",
        "disabled:opacity-60 disabled:pointer-events-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-fill/40",
        compact ? "px-3 py-1.5 text-[0.8125rem]" : "px-4 py-2 text-sm",
      )}
    >
      {!loading && icon && (
        <span
          className={cn(
            "absolute flex items-center",
            compact ? "left-1.5" : "left-2.5",
          )}
        >
          {icon}
        </span>
      )}

      {loading ? <Spinner size="sm" label={label} /> : label}
    </button>
  );
};
