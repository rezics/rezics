import type React from "react";
import { Dialog, DialogContent } from "#/shadcn/dialog";

interface FullScreenModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * 一个支持"插槽"模式的全屏 Modal 组件
 * @param {object} props
 * @param {boolean} props.open - 控制 Modal 的显示与隐藏
 * @param {function} props.onClose - 关闭时触发的回调
 * @param {React.ReactNode} [props.title] - 顶栏插槽，可以传入字符串或 JSX 元素
 * @param {React.ReactNode} [props.children] - 内容区域的默认插槽
 */
const FullScreenModal: React.FC<FullScreenModalProps> = ({
  open,
  onClose,
  title,
  children,
}) => {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-screen h-screen max-w-none rounded-none p-0 flex flex-col gap-0">
        <div className="flex items-center px-4 py-2 border-b border-border-whisper shrink-0">
          <div className="flex-1">
            {typeof title === "string" ? (
              <div className="text-lg font-medium">{title}</div>
            ) : (
              title
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </DialogContent>
    </Dialog>
  );
};

export default FullScreenModal;
