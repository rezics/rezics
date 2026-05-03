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
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="more"
          className={`ml-4 mr-2 ${className ?? ""}`}
        >
          <MoreHorizIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <MiscMenuItems />
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
