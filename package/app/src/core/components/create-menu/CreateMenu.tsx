import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@rezics/ui/shadcn";
import type React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { CreateMenuItem } from "./CreateMenuItem";
import { Plus as AddIcon } from "lucide-react";

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
            className="h-9 rounded-full gap-1 bg-transparent px-3"
            aria-label="create menu"
            {...props}
          >
            <AddIcon className="w-5 h-5" />
            <span>{t("common.create")}</span>
          </Button>
        )}
      />
      <DropdownMenuContent align="end">
        <CreateMenuItem onClose={() => setOpen(false)} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
