import { Star } from "lucide-react";
import type { KeyboardEvent } from "react";

import { cn } from "../../shared/lib/utils";

const DEFAULT_MAX = 10;

const SIZE_CLASS = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
} as const;

const BUTTON_PADDING = {
  sm: "p-0.5",
  md: "p-1",
  lg: "p-1",
} as const;

const GAP = {
  sm: "gap-0.5",
  md: "gap-1",
  lg: "gap-1",
} as const;

export interface RatingInputProps {
  /** Current selection. `null` means no value is chosen. Values are integers in `[1, max]`. */
  value: number | null;
  /** Called when the user changes the selection. Receives `null` when the value is cleared. */
  onChange: (next: number | null) => void;
  /** Upper bound of the rating. Defaults to `10` (the rezics `SCORE_MAX`). */
  max?: number;
  /**
   * Reserved for future fractional support; only `1` is accepted today.
   * The prop is preserved on the type so call sites can declare their intent without churn.
   */
  precision?: 1;
  /** Visual size; defaults to `"md"`. Sizes derive from `--rezics-space-*` tokens via UnoCSS. */
  size?: "sm" | "md" | "lg";
  /** When `true`: not interactive, visually muted, `aria-disabled="true"`. */
  disabled?: boolean;
  /**
   * When `true`: the value is shown but interaction is suppressed. Distinct from `disabled` —
   * `readOnly` keeps full visual emphasis (used for displaying a peer's existing score).
   */
  readOnly?: boolean;
  /** Required when no surrounding `<label>` provides an accessible name. */
  "aria-label"?: string;
}

export function RatingInput({
  value,
  onChange,
  max = DEFAULT_MAX,
  // precision is currently fixed at 1; the prop is part of the type surface so call sites
  // can declare intent. Future fractional support arrives behind a separate change.
  precision: _precision = 1,
  size = "md",
  disabled = false,
  readOnly = false,
  "aria-label": ariaLabel,
}: RatingInputProps) {
  const inert = disabled || readOnly;
  const stars = Array.from({ length: max }, (_, i) => i + 1);

  const emit = (next: number | null) => {
    if (inert) return;
    if (next === value) return;
    onChange(next);
  };

  const handleClick = (star: number) => {
    if (inert) return;
    onChange(star === value ? null : star);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (inert) return;
    const cur = value ?? 0;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp": {
        event.preventDefault();
        const next = Math.min(max, cur + 1);
        if (next >= 1) emit(next);
        return;
      }
      case "ArrowLeft":
      case "ArrowDown": {
        event.preventDefault();
        if (cur > 1) emit(cur - 1);
        return;
      }
      case "Home": {
        event.preventDefault();
        emit(1);
        return;
      }
      case "End": {
        event.preventDefault();
        emit(max);
        return;
      }
      case "Backspace":
      case "Delete": {
        event.preventDefault();
        emit(null);
        return;
      }
      case "Enter":
      case " ": {
        // Roving tabindex anchors focus on the currently selected radio; activating it
        // is a no-op (it's already selected). We swallow the key so it does not scroll
        // the page (Space) or submit a form (Enter) inadvertently.
        if (value !== null) event.preventDefault();
        return;
      }
      default: {
        if (event.key.length === 1 && /^[0-9]$/.test(event.key)) {
          event.preventDefault();
          const digit = Number.parseInt(event.key, 10);
          if (digit === 0) {
            // `0` clears when max < 10; when max >= 10 it represents the digit-0 of "10".
            if (max >= 10) emit(Math.min(max, 10));
            else emit(null);
            return;
          }
          if (digit <= max) emit(digit);
        }
      }
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      aria-readonly={readOnly || undefined}
      data-disabled={disabled || undefined}
      data-readonly={readOnly || undefined}
      tabIndex={inert ? -1 : 0}
      onKeyDown={handleKeyDown}
      className={cn(
        "inline-flex items-center rounded outline-none",
        GAP[size],
        "focus-visible:ring-2 focus-visible:ring-ring",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {stars.map((star) => {
        const filled = value !== null && star <= value;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={filled}
            aria-label={String(star)}
            data-state={filled ? "filled" : "empty"}
            data-value={star}
            disabled={disabled}
            tabIndex={-1}
            onClick={() => handleClick(star)}
            className={cn(
              "border-0 bg-transparent leading-none outline-none",
              BUTTON_PADDING[size],
              "rounded transition-transform",
              !inert && "cursor-pointer hover:scale-110",
              readOnly && "cursor-default",
            )}
          >
            <Star
              aria-hidden="true"
              className={cn(
                SIZE_CLASS[size],
                filled
                  ? "fill-brand-fill stroke-brand-fill"
                  : "fill-none stroke-text-tertiary",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
