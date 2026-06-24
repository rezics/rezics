import { cn } from "#/shared/lib/utils";
import { Button } from "#/shadcn/button";

export type ColorPaletteSwatch = {
  label: string;
  value: string;
};

export type ColorThemeSet<TToken extends string = string> = {
  label: string;
  values: Partial<Record<TToken, string>>;
};

export type ColorPaletteProps<TToken extends string = string> = {
  swatches?: readonly ColorPaletteSwatch[];
  selectedValue?: string;
  onSelect?: (value: string) => void;
  themeSets?: readonly ColorThemeSet<TToken>[];
  onApplyThemeSet?: (values: Partial<Record<TToken, string>>) => void;
  className?: string;
};

/**
 * Rezics-owned palette layer for generic color inputs. The picker mechanics
 * live in `ColorField`; preset swatches and multi-token theme sets stay here
 * instead of depending on a skinned color component library.
 */
export function ColorPalette<TToken extends string = string>({
  swatches = [],
  selectedValue,
  onSelect,
  themeSets = [],
  onApplyThemeSet,
  className,
}: ColorPaletteProps<TToken>) {
  if (swatches.length === 0 && themeSets.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {swatches.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {swatches.map((swatch) => {
            const selected = selectedValue === swatch.value;
            return (
              <button
                key={`${swatch.label}:${swatch.value}`}
                type="button"
                className={cn(
                  "size-7 rounded-sm border border-border-defined outline-none transition-[box-shadow,transform]",
                  "hover:scale-105 focus-visible:ring-2 focus-visible:ring-border-focus",
                  selected && "ring-2 ring-border-focus ring-offset-2",
                )}
                style={{ backgroundColor: swatch.value }}
                aria-label={swatch.label}
                title={`${swatch.label} ${swatch.value}`}
                onClick={() => onSelect?.(swatch.value)}
              />
            );
          })}
        </div>
      ) : null}

      {themeSets.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {themeSets.map((set) => (
            <Button
              key={set.label}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onApplyThemeSet?.(set.values)}
            >
              {set.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
