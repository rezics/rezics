import { useTranslation } from "@rezics/i18n/react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import {
  X as CloseIcon,
  Palette as PaletteIcon,
  RefreshCw as RefreshIcon,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useAppStore } from "@/app";

interface ThemeCustomizerProps {
  open: boolean;
  onClose: () => void;
}

const BRAND_DEFAULT_COLOR = "#DB515C";

// MOCK: local preset palette until token-driven theme picker arrives.
// First entry is the rezics brand red.
// MOCK：在基于 token 的主题选择器到来之前的本地预设调色板。
// 第一项是 rezics 品牌红。
const PRESET_COLORS: string[] = [
  "#DB515C",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
];

export const ThemeCustomizer: React.FC<ThemeCustomizerProps> = ({
  open,
  onClose,
}) => {
  const { t } = useTranslation(["common", "shell"]);
  const customColor = useAppStore((state: any) => state.customColor);
  const setCustomColor = useAppStore((state: any) => state.setCustomColor);

  const [selectedColor, setSelectedColor] = useState(
    customColor || BRAND_DEFAULT_COLOR,
  );
  const [customHex, setCustomHex] = useState("");

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    setCustomColor(color);
    applyAccentColor(color);
  };

  const handleCustomHexChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.target.value;
    setCustomHex(value);

    // Validate the hex color format.
    // 验证十六进制颜色格式。
    if (/^#[0-9A-F]{6}$/i.test(value)) {
      setSelectedColor(value);
      setCustomColor(value);
      applyAccentColor(value);
    }
  };

  const handleReset = () => {
    setSelectedColor(BRAND_DEFAULT_COLOR);
    setCustomColor(BRAND_DEFAULT_COLOR);
    setCustomHex("");
    applyAccentColor(BRAND_DEFAULT_COLOR);
  };

  const handleApply = () => {
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PaletteIcon className="h-5 w-5" />
              <DialogTitle>{t("shell:theme_customizer_title")}</DialogTitle>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              aria-label={t("common:close")}
            >
              <CloseIcon className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          {/* Current color preview. 当前颜色预览。 */}
          <div>
            <p className="text-sm font-medium mb-2">
              {t("shell:theme_customizer_current_accent")}
            </p>
            <div className="flex items-center gap-4">
              <div
                className="h-12 w-12 rounded-md border-2 border-border-whisper"
                style={{ backgroundColor: selectedColor }}
              />
              <div>
                <p className="text-base font-medium">
                  {selectedColor.toUpperCase()}
                </p>
                <p className="text-sm text-text-secondary">
                  {t("shell:theme_customizer_static_theme")}
                </p>
              </div>
            </div>
          </div>

          {/* Preset colors. 预设颜色。 */}
          <div>
            <p className="text-sm font-medium mb-2">
              {t("shell:theme_customizer_preset_colors")}
            </p>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_COLORS.map((color) => (
                <TooltipProvider key={color}>
                  <Tooltip>
                    <TooltipTrigger
                      render={(props) => (
                        <button
                          type="button"
                          onClick={() => handleColorSelect(color)}
                          className={
                            selectedColor === color
                              ? "h-10 w-10 rounded-md border-[3px] border-brand-fill cursor-pointer transition-transform hover:scale-110"
                              : "h-10 w-10 rounded-md border border-border-whisper cursor-pointer transition-transform hover:scale-110"
                          }
                          style={{ backgroundColor: color }}
                          aria-label={color}
                          {...props}
                        />
                      )}
                    />
                    <TooltipContent>{color}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </div>

          {/* Custom hex color. 自定义十六进制颜色。 */}
          <div>
            <p className="text-sm font-medium mb-2">
              {t("shell:theme_customizer_custom_color")}
            </p>
            <div className="flex items-center gap-2">
              {customHex && /^#[0-9A-F]{6}$/i.test(customHex) && (
                <div
                  className="h-5 w-5 rounded-full border border-border-whisper"
                  style={{ backgroundColor: customHex }}
                />
              )}
              <Input
                placeholder="#FF5722"
                value={customHex}
                onChange={handleCustomHexChange}
                className="flex-1"
              />
            </div>
            <p className="text-sm text-text-secondary mt-1">
              {t("shell:theme_customizer_hex_format")}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleReset} className="gap-1">
            <RefreshIcon className="h-4 w-4" />
            {t("common:reset")}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t("common:cancel")}
          </Button>
          <Button onClick={handleApply}>{t("common:apply")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Quick theme toggle button component.
// 快速主题切换按钮组件。
export const ThemeQuickToggle: React.FC = () => {
  const { t } = useTranslation(["common", "shell"]);
  const [open, setOpen] = useState(false);

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={(props) => (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setOpen(true)}
                className="!text-white"
                aria-label={t("shell:theme_customizer_title")}
                {...props}
              >
                <PaletteIcon className="h-5 w-5" />
              </Button>
            )}
          />
          <TooltipContent>{t("shell:theme_customizer_title")}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <ThemeCustomizer open={open} onClose={() => setOpen(false)} />
    </>
  );
};

function applyAccentColor(color: string) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--colors-brand-fill", color);
  document.documentElement.style.setProperty("--colors-primary", color);
  document.documentElement.style.setProperty("--colors-primary-DEFAULT", color);
}
