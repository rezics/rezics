import { useTranslation } from "@rezics/i18n/react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@rezics/ui/shadcn";
import { SquarePlus } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { HeaderTooltip } from "../header/HeaderTooltip";
import { CreateMenuItem } from "./CreateMenuItem";

export const CreateMenu: React.FC = () => {
  const { t } = useTranslation(["shell"]);
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        nativeButton
        render={(props) => (
          <HeaderTooltip label="Create new">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 min-w-9 rounded-full bg-transparent md:h-10 md:min-w-10"
              aria-label={t("shell:app_create_menu_aria_label")}
              {...props}
            >
              <SquarePlus className="h-5 w-5" />
            </Button>
          </HeaderTooltip>
        )}
      />
      <DropdownMenuContent align="end">
        <CreateMenuItem onClose={() => setOpen(false)} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
