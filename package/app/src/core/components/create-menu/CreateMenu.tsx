import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@rezics/ui/shadcn";
import { Plus as AddIcon } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useTranslation } from "@rezics/i18n/react";
import { CreateMenuItem } from "./CreateMenuItem";

export const CreateMenu: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        nativeButton
        render={(props) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 rounded-full gap-1 bg-transparent px-2 md:h-10 md:px-4"
            aria-label="create menu"
            {...props}
          >
            <AddIcon className="w-5 h-5" />
            <span className="hidden md:inline">{t("common.create")}</span>
          </Button>
        )}
      />
      <DropdownMenuContent align="end">
        <CreateMenuItem onClose={() => setOpen(false)} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
