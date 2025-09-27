import { AppBar, Box, IconButton, Modal, Slide, Toolbar, Typography } from "@mui/material";
import React from "react";
// import { TransitionProps } from "@mui/material/transitions";
import CloseIcon from "@mui/icons-material/Close";
//  ;

// 过渡动画 (从下方滑入)
const Transition = React.forwardRef(function Transition(props: any, ref: any) {
  return <Slide direction="up" ref={ref} {...props} />;
});

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
    <Modal open={open} onClose={onClose} closeAfterTransition>
      <Transition in={open}>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            height: "100vh",
            width: "100vw",
            bgcolor: "background.paper",
          }}
        >
          {/* 顶栏: 承载 title 插槽 */}
          <AppBar position="static" sx={{ flexShrink: 0 }}>
            <Toolbar>
              <Box sx={{ flexGrow: 1 }}>
                {
                  /* 这里是 title 插槽的关键逻辑：
                  - 如果 title 是字符串, 用 Typography 组件包裹来应用默认样式
                  - 如果 title 是一个 React 元素 (JSX), 则直接渲染
                */
                }
                {typeof title === "string"
                  ? (
                    <Typography variant="h6" component="div">
                      {title}
                    </Typography>
                  )
                  : title}
              </Box>

              {/* 关闭按钮 */}
              <IconButton
                edge="end"
                color="inherit"
                onClick={onClose}
                aria-label="Close"
              >
                <CloseIcon />
              </IconButton>
            </Toolbar>
          </AppBar>

          {/* 内容区: 默认插槽 */}
          <Box
            sx={{
              flexGrow: 1,
              p: 3,
              overflowY: "auto",
            }}
          >
            {children}
          </Box>
        </Box>
      </Transition>
    </Modal>
  );
};

export default FullScreenModal;
