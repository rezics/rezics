import { useTranslation } from "@rezics/i18n/react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@rezics/ui/shadcn";
import { Plus as AddIcon } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { CreateMenuItem } from "./CreateMenuItem";

export const CreateMenu: React.FC = () => {
  const { t } = useTranslation(["common", "shell"]);
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        nativeButton
        render={(props) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 rounded-full gap-1 bg-transparent px-2 md:h-10 md:px-4"
            aria-label={t("shell:app_create_menu_aria_label")}
            {...props}
          >
            <AddIcon className="w-5 h-5" />
            <span className="hidden md:inline">{t("common:create")}</span>
          </Button>
        )}
      />
      <DropdownMenuContent align="end">
        <CreateMenuItem onClose={() => setOpen(false)} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
