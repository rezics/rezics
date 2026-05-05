import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@rezics/ui/shadcn";
import type React from "react";
import { MiscMenuItems } from "./MiscMenuItems";
import { Ellipsis as MoreHorizIcon } from "lucide-react";

type Props = {
  children?: React.ReactNode;
  className?: string;
};

export function MoreHorizMenu({ children, className }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        nativeButton
        render={(props) => (
          <Button
            variant="ghost"
            size="icon"
            aria-label="more"
            className={`ml-4 mr-2 h-10 min-w-10 rounded-full bg-transparent ${className ?? ""}`}
            {...props}
          >
            <MoreHorizIcon className="w-5 h-5" />
          </Button>
        )}
      />
      <DropdownMenuContent align="end">
        <MiscMenuItems />
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
