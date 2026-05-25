import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@rezics/ui/shadcn";
import { Ellipsis as MoreHorizIcon } from "lucide-react";
import type React from "react";
import { MiscMenuItems } from "./MiscMenuItems";
import { useMessage } from "@rezics/i18n/react";
import { common_more } from "@rezics/i18n/messages";
const i18nMessages = {
  common_more,
};

type Props = {
  children?: React.ReactNode;
  className?: string;
};

export function MoreHorizMenu({ children, className }: Props) {
  const m = useMessage(i18nMessages);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        nativeButton
        render={(props) => (
          <Button
            variant="ghost"
            size="icon"
            aria-label={m.common_more()}
            className={`ml-1 h-9 min-w-9 rounded-full bg-transparent md:ml-4 md:mr-2 md:h-10 md:min-w-10 ${className ?? ""}`}
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
