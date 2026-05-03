import { Box, Fab, Zoom } from "@mui/material";
import * as React from "react";
import FeedbackDialog from "@/feedback/components/FeedbackDialog";
import { Plus as AddIcon, FileText as ArticleOutlined, Bug as BugReport, MessageCircle as ChatBubbleOutline, X as CloseIcon, TriangleAlert as ReportProblemIcon } from "lucide-react";

export interface HelpFabAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

export interface HelpFabProps {
  actions?: HelpFabAction[];
  icon?: React.ReactNode;
  ariaLabel?: string;
  visible?: boolean;
  enterDelayMs?: number;
}

const _defaultHelpActionsFutureExample: HelpFabAction[] = [
  {
    id: "quick-start",
    label: "快速上手",
    icon: <ArticleOutlined fontSize="small" />,
    onClick: () => {
      console.log("打开快速上手文档");
    },
  },
  {
    id: "faq",
    label: "常见问题 FAQ",
    icon: <ArticleOutlined fontSize="small" />,
    onClick: () => {
      console.log("打开 FAQ 页面");
    },
  },
  {
    id: "bug",
    label: "提交 Bug",
    icon: <BugReport fontSize="small" />,
    onClick: () => {
      console.log("打开 Bug 反馈入口");
    },
  },
  {
    id: "suggestion",
    label: "功能建议",
    icon: <ChatBubbleOutline fontSize="small" />,
    onClick: () => {
      console.log("打开功能建议入口");
    },
  },
];

const defaultHelpActions: HelpFabAction[] = [
  {
    id: "feedback",
    label: "反馈",
    icon: <ReportProblemIcon fontSize="small" />,
  },
];

/**
 * Floating Action Button (FAB) for help
 */
export const HelpFab: React.FC<HelpFabProps> = ({
  actions,
  icon,
  ariaLabel = "帮助",
  visible = true,
  enterDelayMs = 0,
}) => {
  const [open, setOpen] = React.useState(false);

  const [feedbackDialogOpen, setFeedbackDialogOpen] = React.useState(false);

  const list = actions ?? defaultHelpActions;
  if (!list.length) return null;

  const handleToggle = () => {
    setOpen((prev) => !prev);
  };

  const handleActionClick = (item: HelpFabAction) => {
    item.onClick?.();
    if (item.id === "feedback") {
      setFeedbackDialogOpen(true);
    }
    setOpen(false);
  };

  // Animation duration
  const transitionDuration = {
    appear: 0,
    enter: 225,
    exit: 195,
  } as const;

  return (
    <Box
      sx={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: (theme) => theme.zIndex.tooltip + 1,
      }}
    >
      {/* Action FAB list */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column-reverse", // Stack from bottom to top, for delay
          alignItems: "flex-end",
          mb: 1.5,
          pointerEvents: "none", // Only allow internal FAB to handle events
        }}
      >
        {list.map((item, index) => {
          // Reverse the index to make the nearest one appear first
          const reversedIndex = list.length - 1 - index;
          const delay = open ? (reversedIndex + 1) * 30 : 0;

          return (
            <Zoom
              key={item.id}
              in={visible && open}
              timeout={transitionDuration}
              style={{
                transitionDelay: `${delay}ms`,
              }}
              unmountOnExit
            >
              <Fab
                variant="extended"
                size="small"
                color="default"
                onClick={() => handleActionClick(item)}
                sx={{
                  mt: 1,
                  pointerEvents: "auto",
                  boxShadow: (theme) => theme.shadows[6],
                  px: 1.5,
                  minHeight: 32,
                }}
              >
                {item.icon && (
                  <span className="mr-1 flex items-center">{item.icon}</span>
                )}
                {item.label}
              </Fab>
            </Zoom>
          );
        })}
      </Box>

      {/* Main FAB: Control open/close + overall visibility */}
      <Zoom
        in={visible}
        className="float-end"
        timeout={transitionDuration}
        style={{
          transitionDelay: visible ? `${enterDelayMs}ms` : "0ms",
        }}
        unmountOnExit
      >
        <Fab color="primary" aria-label={ariaLabel} onClick={handleToggle}>
          {/* Change to close icon when open, for better UX */}
          {open ? <CloseIcon /> : (icon ?? <AddIcon />)}
        </Fab>
      </Zoom>
      <FeedbackDialog
        open={feedbackDialogOpen}
        onClose={() => setFeedbackDialogOpen(false)}
      />
    </Box>
  );
};
