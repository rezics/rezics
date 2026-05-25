import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rezics/ui/shadcn";
import {
  BookmarkPlus,
  MessageSquare,
  MoreHorizontal,
  Share2,
} from "lucide-react";
import type React from "react";
import type { Action, EngagementSize } from "../types";
import { useMessage } from "@rezics/i18n/react";
import {
  common_more_actions,
  common_reply,
  common_share,
  shelf_title,
} from "@rezics/i18n/messages";
const m = {
  common_more_actions,
  common_reply,
  common_share,
  shelf_title,
};

const i18nMessages = {
  common_more_actions,
  common_reply,
  common_share,
  shelf_title,
};

export type OverflowMenuProps = {
  items: Action[];
  size?: EngagementSize;
  onInvoke: (action: Action) => void;
  children?: React.ReactNode;
};

type MenuDescriptor = { label: () => string; icon: React.ReactNode };

const DESCRIPTORS: Partial<Record<Action, MenuDescriptor>> = {
  reply: {
    label: m.common_reply,
    icon: <MessageSquare size={18} strokeWidth={2} />,
  },
  share: { label: m.common_share, icon: <Share2 size={18} strokeWidth={2} /> },
  shelf: {
    label: m.shelf_title,
    icon: <BookmarkPlus size={18} strokeWidth={2} />,
  },
};

function sizeToIconPx(size: EngagementSize): number {
  switch (size) {
    case "sm":
      return 16;
    case "lg":
      return 22;
    default:
      return 18;
  }
}

export const OverflowMenu: React.FC<OverflowMenuProps> = ({
  items,
  size = "md",
  onInvoke,
  children,
}) => {
  const m = useMessage(i18nMessages);
  const visible = items.filter(
    (token) => DESCRIPTORS[token] !== undefined,
  ) as Action[];

  if (visible.length === 0 && !children) return null;

  const handleSelect = (event: Event | React.MouseEvent, action: Action) => {
    if ("stopPropagation" in event) event.stopPropagation();
    onInvoke(action);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        nativeButton
        render={(props) => (
          <Button
            variant="ghost"
            size={size === "lg" ? "default" : "sm"}
            aria-label={m.common_more_actions()}
            className="text-text-secondary"
            onClick={(event) => event.stopPropagation()}
            {...props}
          >
            <MoreHorizontal size={sizeToIconPx(size)} strokeWidth={2} />
          </Button>
        )}
      />
      <DropdownMenuContent
        align="start"
        onClick={(event) => event.stopPropagation()}
      >
        {visible.map((token) => {
          const descriptor = DESCRIPTORS[token];
          if (!descriptor) return null;
          return (
            <DropdownMenuItem
              key={token}
              onSelect={(event) =>
                handleSelect(event as unknown as Event, token)
              }
              className="gap-2"
            >
              {descriptor.icon}
              <span>{descriptor.label()}</span>
            </DropdownMenuItem>
          );
        })}
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
