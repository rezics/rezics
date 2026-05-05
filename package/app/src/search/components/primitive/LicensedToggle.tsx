import { Checkbox } from "@rezics/ui/shadcn";
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
    <div className="m-0 inline-flex items-center gap-2">
      <Checkbox
        checked={!!value}
        onCheckedChange={(checked) => onChange(checked === true || undefined)}
        aria-label={t("search.tooltips.licensed")}
      />
      <IsLicensedInfo tooltipTitle={t("search.tooltips.licensed")} />
    </div>
  );
};
