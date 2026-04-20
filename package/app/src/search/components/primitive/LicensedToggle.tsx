import { Checkbox, FormControlLabel } from "@mui/material";
import type React from "react";
import { useTranslation } from "react-i18next";
import { IsLicensedInfo } from "@/book-edit/components/Metadata/BookMetadataEditor";

export type LicensedToggleProps = {
  value: boolean | undefined;
  onChange: (value: boolean | undefined) => void;
};

export const LicensedToggle: React.FC<LicensedToggleProps> = ({
  value,
  onChange,
}) => {
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
      label={<IsLicensedInfo tooltipTitle={t("search.tooltips.licensed")} />}
    />
  );
};
