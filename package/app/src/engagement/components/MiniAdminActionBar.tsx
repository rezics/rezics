import { useCanEdit } from "@rezics/api/hooks";
import type { EditableResource } from "@rezics/api/hooks";
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { Pencil as Edit } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/css-util";

interface MiniAdminActionBarProps {
  editionURL: string;
  textColor?: string;
  userUnitId?: string;
  resource?: EditableResource;
}

export function MiniAdminActionBar({
  editionURL,
  textColor,
  userUnitId,
  resource = "post",
}: MiniAdminActionBarProps) {
  const { t } = useTranslation();
  const canEdit = useCanEdit({
    resource,
    ownerUnit: userUnitId ? { user: { unitId: userUnitId } } : undefined,
  });
  const navigate = useNavigate();

  if (!canEdit) {
    return null;
  }
  return (
    <span>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("common.edit")}
              onClick={() => {
                navigate({ to: editionURL });
              }}
              className="h-7 w-7"
            >
              <Edit className={cn("h-4 w-4", textColor)} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">{t("common.edit")}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </span>
  );
}
