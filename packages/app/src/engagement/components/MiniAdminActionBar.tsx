import type { EditableResource } from "@rezics/contract/api/hooks/useCanEdit";
import { useCanEdit } from "@rezics/contract/api/hooks/useCanEdit";
import { useTranslation } from "@rezics/i18n/react";
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { Pencil as Edit } from "lucide-react";
import { cn } from "@/shared/utils/css-util";

interface MiniAdminActionBarProps {
  editionURL: string;
  textColor?: string;
  userId?: string;
  resource?: EditableResource;
}

export function MiniAdminActionBar({
  editionURL,
  textColor,
  userId,
  resource = "post",
}: MiniAdminActionBarProps) {
  const { t } = useTranslation(["common"]);
  const canEdit = useCanEdit({
    resource,
    ownerUnit: userId ? { user: { unitId: userId } } : undefined,
  });
  const navigate = useNavigate();

  if (!canEdit) {
    return null;
  }
  return (
    <span>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={(props) => (
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("common:edit")}
                onClick={() => {
                  navigate({ to: editionURL });
                }}
                className="h-7 w-7"
                {...props}
              >
                <Edit className={cn("h-4 w-4", textColor)} />
              </Button>
            )}
          />
          <TooltipContent side="top">{t("common:edit")}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </span>
  );
}
