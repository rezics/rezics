import { useTranslation } from "@rezics/i18n/react";
import { X } from "lucide-react";
import type React from "react";
import { useEffect } from "react";
import { cn } from "@/shared/utils/css-util";

// --- 类型定义 ---
export type SidebarMode = "fixed" | "inline";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: SidebarMode;
  width?: string;
  className?: string;
  children: React.ReactNode;
  isDragging?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  mode = "inline",
  width = "320px",
  className,
  children,
  isDragging = false,
}) => {
  const { t } = useTranslation(["shell"]);
  // handle escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (mode === "fixed" && isOpen && e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [mode, isOpen, onClose]);

  // --- Fixed 模式渲染逻辑 ---
  if (mode === "fixed") {
    return (
      <div className="bg-surface-canvas">
        {/* 背景遮罩 (Backdrop) - 处理淡入淡出 */}
        <div
          className={cn(
            "fixed inset-0 z-40 transition-opacity duration-300 ease-in-out",
            isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
          onClick={onClose}
          aria-hidden="true"
        />

        {/* 侧边栏面板 - 处理滑入滑出 */}
        <aside
          className={cn(
            "fixed top-0 left-0 z-50 h-full shadow-xl transition-transform duration-300 ease-in-out border-r border-border-whisper",
            isOpen ? "translate-x-0" : "-translate-x-full",
          )}
          style={{ width }}
        >
          <div
            className={cn(
              "relative h-full flex flex-col overflow-hidden bg-surface-canvas",
              className,
            )}
          >
            {/* 仅在 Fixed 模式下，通常需要一个显式的关闭按钮 */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-1 rounded-md transition-colors"
              aria-label={t("shell:app_close_sidebar_aria_label")}
            >
              <X size={20} className="text-slate-500" />
            </button>
            {children}
          </div>
        </aside>
      </div>
    );
  }

  /**
   * Inline 模式渲染逻辑
   */
  return (
    <div className="inline-sidebar-container bg-surface-canvas">
      <div
        className={cn(`shrink-0`)}
        style={{
          width: isOpen ? width : "0px",
          transition: !isDragging ? "width 0.3s ease-in-out" : "none",
        }}
      />
      <div
        className={cn(
          `fixed inset-y-0 left-0 overflow-hidden border-r border-border-whisper`,
        )}
        style={{
          width,
          transform: isOpen ? "translateX(0)" : `translateX(-${width})`,
          transition: "transform 0.3s ease-in-out",
        }}
      >
        <div className={cn("h-full", className)}>
          <div className="h-full w-full">{children}</div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
