import { Button } from "@rezics/ui/shadcn";
import { cn } from "@/shared/utils/css-util";
import * as React from "react";
import FeedbackDialog from "@/feedback/components/FeedbackDialog";
import {
  Plus as AddIcon,
  FileText as ArticleOutlined,
  Bug as BugReport,
  MessageCircle as ChatBubbleOutline,
  X as CloseIcon,
  TriangleAlert as ReportProblemIcon,
} from "lucide-react";

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
    icon: <ArticleOutlined className="w-4 h-4" />,
    onClick: () => {
      console.log("打开快速上手文档");
    },
  },
  {
    id: "faq",
    label: "常见问题 FAQ",
    icon: <ArticleOutlined className="w-4 h-4" />,
    onClick: () => {
      console.log("打开 FAQ 页面");
    },
  },
  {
    id: "bug",
    label: "提交 Bug",
    icon: <BugReport className="w-4 h-4" />,
    onClick: () => {
      console.log("打开 Bug 反馈入口");
    },
  },
  {
    id: "suggestion",
    label: "功能建议",
    icon: <ChatBubbleOutline className="w-4 h-4" />,
    onClick: () => {
      console.log("打开功能建议入口");
    },
  },
];

const defaultHelpActions: HelpFabAction[] = [
  {
    id: "feedback",
    label: "反馈",
    icon: <ReportProblemIcon className="w-4 h-4" />,
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

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[1502]"
      style={{ transitionDelay: `${enterDelayMs}ms` }}
    >
      {/* Action FAB list */}
      <div className="flex flex-col-reverse items-end mb-3 pointer-events-none">
        {list.map((item, index) => {
          const reversedIndex = list.length - 1 - index;
          const delay = open ? (reversedIndex + 1) * 30 : 0;

          return (
            <div
              key={item.id}
              className={cn(
                "transition-all duration-225 ease-out mt-2 pointer-events-auto",
                open
                  ? "opacity-100 scale-100"
                  : "opacity-0 scale-0 pointer-events-none",
              )}
              style={{ transitionDelay: `${delay}ms` }}
            >
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleActionClick(item)}
                className="shadow-lg rounded-full px-3 min-h-8"
              >
                {item.icon && (
                  <span className="mr-1 flex items-center">{item.icon}</span>
                )}
                {item.label}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Main FAB */}
      <div className="float-end">
        <Button
          variant="default"
          size="icon"
          aria-label={ariaLabel}
          onClick={handleToggle}
          className="rounded-full shadow-lg w-14 h-14"
        >
          {open ? <CloseIcon /> : (icon ?? <AddIcon />)}
        </Button>
      </div>

      <FeedbackDialog
        open={feedbackDialogOpen}
        onClose={() => setFeedbackDialogOpen(false)}
      />
    </div>
  );
};
