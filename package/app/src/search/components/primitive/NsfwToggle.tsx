import { Checkbox, FormControlLabel } from "@mui/material";
import type React from "react";
import { useTranslation } from "react-i18next";
import { NSFWInfo } from "@/book-edit/components/Metadata/BookMetadataEditor";

export type NsfwToggleProps = {
  value: boolean | undefined;
  onChange: (value: boolean | undefined) => void;
};

export const NsfwToggle: React.FC<NsfwToggleProps> = ({ value, onChange }) => {
  const { t } = useTranslation();
  return (
    <FormControlLabel
      className="m-0"
      control={
        <Checkbox
          size="small"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked || undefined)}
        />
      }
      label={<NSFWInfo tooltipTitle={t("search.tooltips.nsfw")} />}
    />
  );
};
