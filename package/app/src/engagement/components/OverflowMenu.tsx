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

export type OverflowMenuProps = {
  items: Action[];
  size?: EngagementSize;
  onInvoke: (action: Action) => void;
};

type MenuDescriptor = { label: string; icon: React.ReactNode };

const DESCRIPTORS: Partial<Record<Action, MenuDescriptor>> = {
  reply: { label: "Reply", icon: <MessageSquare size={18} strokeWidth={2} /> },
  share: { label: "Share", icon: <Share2 size={18} strokeWidth={2} /> },
  shelf: { label: "Shelf", icon: <BookmarkPlus size={18} strokeWidth={2} /> },
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
}) => {
  const visible = items.filter(
    (token) => DESCRIPTORS[token] !== undefined,
  ) as Action[];

  if (visible.length === 0) return null;

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
            aria-label="More actions"
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
              onSelect={(event) => handleSelect(event, token)}
              className="gap-2"
            >
              {descriptor.icon}
              <span>{descriptor.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
