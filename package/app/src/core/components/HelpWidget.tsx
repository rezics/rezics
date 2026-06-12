import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import {
  Plus as AddIcon,
  X as CloseIcon,
  TriangleAlert as ReportProblemIcon,
} from "lucide-react";
import * as React from "react";
import { FeedbackDialog } from "@/feedback";
import { cn } from "@/shared/utils/css-util";
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

/**
 * Floating Action Button (FAB) for help
 * 用于帮助的浮动操作按钮（FAB）
 */
export const HelpFab: React.FC<HelpFabProps> = ({
  actions,
  icon,
  ariaLabel,
  visible = true,
  enterDelayMs = 0,
}) => {
  const { t } = useTranslation(["shell"]);
  const [open, setOpen] = React.useState(false);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = React.useState(false);

  const list = actions ?? getDefaultHelpActions(t);
  const resolvedAriaLabel = ariaLabel ?? t("shell:app_help_aria_label");
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

  // Close panel on Escape key
  // 按 Escape 键关闭面板
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[1502]"
      style={{ transitionDelay: `${enterDelayMs}ms` }}
    >
      {/* Action FAB list */}
      {/* 操作 FAB 列表 */}
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
      {/* 主 FAB */}
      <div className="float-end">
        <Button
          variant="default"
          size="icon"
          aria-label={resolvedAriaLabel}
          aria-expanded={open}
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

function getDefaultHelpActions(t: (key: string) => string): HelpFabAction[] {
  return [
    {
      id: "feedback",
      label: t("shell:app_help_feedback"),
      icon: <ReportProblemIcon className="w-4 h-4" />,
    },
  ];
}
