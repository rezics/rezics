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
import * as m from "@rezics/i18n/messages";

export const CreateMenu: React.FC = () => {
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
            aria-label={m.app_create_menu_aria_label()}
            {...props}
          >
            <AddIcon className="w-5 h-5" />
            <span className="hidden md:inline">{m.common_create()}</span>
          </Button>
        )}
      />
      <DropdownMenuContent align="end">
        <CreateMenuItem onClose={() => setOpen(false)} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
