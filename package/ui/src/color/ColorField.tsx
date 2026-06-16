import { useTranslation } from "@rezics/i18n/react";
import { HexColorInput, HexColorPicker } from "react-colorful";
import { useId } from "react";
import { cn } from "#/shared/lib/utils";
import { Button } from "#/shadcn/button";
import { Input } from "#/shadcn/input";
import { Label } from "#/shadcn/label";
import { Popover, PopoverContent, PopoverTrigger } from "#/shadcn/popover";
import {
  ColorPalette,
  type ColorPaletteSwatch,
  type ColorThemeSet,
} from "./ColorPalette";

export type ColorFieldProps<TToken extends string = string> = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  swatches?: readonly ColorPaletteSwatch[];
  themeSets?: readonly ColorThemeSet<TToken>[];
  onApplyThemeSet?: (values: Partial<Record<TToken, string>>) => void;
  disabled?: boolean;
  className?: string;
};

const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const FALLBACK_PICKER_COLOR = "#db515c";

function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const prefixed = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return HEX_COLOR_RE.test(prefixed) ? prefixed : null;
}

/**
 * Generic color input for Rezics editors. `react-colorful` owns the picker
 * mechanics only; the raw text input remains authoritative so hosts can keep
 * accepting arbitrary CSS color strings such as `rgb()` and `oklch()`.
 */
export function ColorField<TToken extends string = string>({
  label,
  value,
  onChange,
  placeholder,
  swatches,
  themeSets,
  onApplyThemeSet,
  disabled,
  className,
}: ColorFieldProps<TToken>) {
  const { t } = useTranslation("common");
  const pickerColor = normalizeHex(value) ?? FALLBACK_PICKER_COLOR;
  const generatedId = useId();
  const inputId = label ? generatedId : undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label ? <Label htmlFor={inputId}>{label}</Label> : null}
      <div className="flex min-w-0 items-center gap-2">
        <Popover>
          <PopoverTrigger
            render={
              <Button
                type="button"
                size="icon"
                variant="outline"
                disabled={disabled}
                aria-label={label ? `${label} ${t("color_picker")}` : t("color_picker")}
              />
            }
          >
            <span
              aria-hidden
              className="size-5 rounded-sm border border-border-defined"
              style={{ backgroundColor: value || "transparent" }}
            />
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className={cn(
              "w-72 rounded-md p-3",
              "[&_.react-colorful]:h-40 [&_.react-colorful]:w-full",
              "[&_.react-colorful__hue]:mt-3 [&_.react-colorful__hue]:h-3",
              "[&_.react-colorful__hue-pointer]:size-4",
              "[&_.react-colorful__pointer]:border-border-defined [&_.react-colorful__pointer]:shadow-sm",
              "[&_.react-colorful__saturation]:rounded-md",
            )}
          >
            <div className="flex flex-col gap-3">
              <HexColorPicker color={pickerColor} onChange={onChange} />
              <HexColorInput
                className={cn(
                  "h-9 w-full rounded-3xl bg-input/50 px-3 py-1 font-mono text-base outline-none transition-[color,box-shadow,background-color]",
                  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm",
                )}
                color={pickerColor}
                onChange={onChange}
                prefixed
              />
              <ColorPalette
                swatches={swatches}
                selectedValue={value}
                onSelect={onChange}
                themeSets={themeSets}
                onApplyThemeSet={onApplyThemeSet}
              />
            </div>
          </PopoverContent>
        </Popover>
        <Input
          id={inputId}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          className="font-mono text-sm"
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  );
}
