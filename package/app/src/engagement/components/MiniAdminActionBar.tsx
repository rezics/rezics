import { IconButton, Tooltip } from "@mui/material";
import { useCanEdit } from "@rezics/api/hooks";
import type { EditableResource } from "@rezics/api/hooks";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Pencil as Edit } from "lucide-react";

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
      <Tooltip title={t("common.edit")} placement="top">
        <IconButton
          aria-label={t("common.edit")}
          size="small"
          onClick={() => {
            navigate({ to: editionURL });
          }}
        >
          <Edit fontSize="small" className={textColor} />
        </IconButton>
      </Tooltip>
    </span>
  );
}
