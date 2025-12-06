import CloseIcon from "@mui/icons-material/Close";
import AppBar from "@mui/material/AppBar";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import React from "react";

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
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth={maxWidth}
      fullScreen={fullScreen}
      scroll="paper"
      // MUI Dialog 默认支持 Esc 关闭
    >
      <AppBar
        position="relative"
        elevation={1}
        sx={{ position: fullScreen ? "fixed" : "static" }}
      >
        <Toolbar variant="dense">
          {title && (
            <Typography
              variant="h6"
              component="div"
              sx={{ flexGrow: 1 }}
            >
              {title}
            </Typography>
          )}
          <IconButton
            edge="end"
            color="inherit"
            onClick={onClose}
            aria-label="close"
            size="large"
          >
            <CloseIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <DialogContent dividers sx={{ p: 2 }}>
        {children}
      </DialogContent>
    </Dialog>
  );
};

export default DialogContainer;
