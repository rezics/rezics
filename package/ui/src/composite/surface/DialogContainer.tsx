import type React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "#/shadcn/dialog";

export interface DialogContainerProps {
  /** 控制对话框显示 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 状态栏标题 */
  title?: string;
  /** 内容区域 */
  children?: React.ReactNode;
  /** 对话框宽度，可选 xs, sm, md, lg, xl */
  maxWidth?: "xs" | "sm" | "md" | "lg" | "xl";
  /** 是否全屏 */
  fullScreen?: boolean;
}

const MAX_WIDTH_CLASS: Record<
  NonNullable<DialogContainerProps["maxWidth"]>,
  string
> = {
  xs: "sm:max-w-xs",
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
};

/**
 * 通用弹窗容器，包含状态栏（标题+关闭按钮）和内容展示区。
 * 支持Esc键或点击关闭按钮关闭，对话框关闭时调用 onClose。
 */
const DialogContainer: React.FC<DialogContainerProps> = ({
  open,
  onClose,
  title,
  children,
  maxWidth = "md",
  fullScreen = false,
}) => {
  const widthClass = fullScreen
    ? "w-screen h-screen max-w-none rounded-none p-0"
    : MAX_WIDTH_CLASS[maxWidth];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={widthClass}>
        {title && (
          <DialogHeader className={fullScreen ? "px-4 pt-4" : undefined}>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
        )}
        <div
          className={
            fullScreen
              ? "flex-1 overflow-y-auto p-4"
              : "border-t border-border-whisper pt-2"
          }
        >
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DialogContainer;
