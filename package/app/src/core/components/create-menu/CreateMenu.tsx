import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@rezics/ui/shadcn";
import type React from "react";
import { useState } from "react";

import { CreateMenuItem } from "./CreateMenuItem";
import {
  Plus as AddIcon,
  ChevronDown as ArrowDropDownIcon,
} from "lucide-react";

export const CreateMenu: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        nativeButton
        render={(props) => (
          <Button
            variant="outline"
            size="sm"
            className="rounded-md gap-1 px-2"
            aria-label="create menu"
            {...props}
          >
            <AddIcon className="w-4 h-4" />
            <ArrowDropDownIcon className="w-4 h-4" />
          </Button>
        )}
      />
      <DropdownMenuContent align="end">
        <CreateMenuItem onClose={() => setOpen(false)} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
