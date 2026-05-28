import { useTranslation } from "@rezics/i18n/react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@rezics/ui/shadcn";
import { Ellipsis as MoreHorizIcon } from "lucide-react";
import type React from "react";
import { MiscMenuItems } from "./MiscMenuItems";

type Props = {
  children?: React.ReactNode;
  className?: string;
};

export function MoreHorizMenu({ children, className }: Props) {
  const { t } = useTranslation(["common"]);
return (
    <DropdownMenu>
      <DropdownMenuTrigger
        nativeButton
        render={(props) => (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("common:more")}
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
