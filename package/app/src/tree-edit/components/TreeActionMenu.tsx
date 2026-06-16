import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@rezics/ui/shadcn";
import { MoreHorizontal } from "lucide-react";
import type { TreeActionItem } from "../models/types";

interface TreeActionMenuProps {
  actions: readonly TreeActionItem[];
  label?: string;
}

export function TreeActionMenu({
  actions,
  label = "More actions",
}: TreeActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        nativeButton
        render={(props) => (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 shrink-0"
            aria-label={label}
            {...props}
            onClick={(event) => {
              event.stopPropagation();
              props.onClick?.(event);
            }}
            onDoubleClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        )}
      />
      <DropdownMenuContent align="end">
        {actions.map((action) => (
          <div key={action.key}>
            {action.separatorBefore ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              disabled={action.disabled}
              variant={action.destructive ? "destructive" : undefined}
              onClick={action.onSelect}
            >
              {action.icon ? (
                <span className="mr-2 flex size-4 items-center justify-center">
                  {action.icon}
                </span>
              ) : null}
              {action.label}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
