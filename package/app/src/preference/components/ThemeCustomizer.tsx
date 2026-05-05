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
  Palette as PaletteIcon,
  RefreshCw as RefreshIcon,
  X as CloseIcon,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useAppStore } from "@/app/states/appStore";

const BRAND_DEFAULT_COLOR = "#f4606c";

// MOCK: local preset palette until token-driven theme picker arrives.
// First entry is the rezics brand red.
const PRESET_COLORS: string[] = [
  "#f4606c",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
];

function applyAccentColor(color: string) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty(
    "--rezics-sys-color-brand-fill",
    color,
  );
  document.documentElement.style.setProperty(
    "--rezics-sys-color-primary",
    color,
  );
}

interface ThemeCustomizerProps {
  open: boolean;
  onClose: () => void;
}

export const ThemeCustomizer: React.FC<ThemeCustomizerProps> = ({
  open,
  onClose,
}) => {
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

    // 验证十六进制颜色格式
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
              <DialogTitle>主题自定义</DialogTitle>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              aria-label="Close"
            >
              <CloseIcon className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          {/* 当前颜色预览 */}
          <div>
            <p className="text-sm font-medium mb-2">当前主色调</p>
            <div className="flex items-center gap-4">
              <div
                className="h-12 w-12 rounded-md border-2 border-border-whisper"
                style={{ backgroundColor: selectedColor }}
              />
              <div>
                <p className="text-base font-medium">
                  {selectedColor.toUpperCase()}
                </p>
                <p className="text-sm text-text-secondary">静态主题</p>
              </div>
            </div>
          </div>

          {/* 预设颜色 */}
          <div>
            <p className="text-sm font-medium mb-2">预设颜色</p>
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

          {/* 自定义十六进制颜色 */}
          <div>
            <p className="text-sm font-medium mb-2">自定义颜色</p>
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
              输入格式: #RRGGBB
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleReset} className="gap-1">
            <RefreshIcon className="h-4 w-4" />
            重置
          </Button>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleApply}>应用</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// 快速主题切换按钮组件
export const ThemeQuickToggle: React.FC = () => {
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
                aria-label="主题自定义"
                {...props}
              >
                <PaletteIcon className="h-5 w-5" />
              </Button>
            )}
          />
          <TooltipContent>主题自定义</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <ThemeCustomizer open={open} onClose={() => setOpen(false)} />
    </>
  );
};
