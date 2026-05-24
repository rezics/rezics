import * as m from "@rezics/i18n/messages";
import { Checkbox } from "@rezics/ui/shadcn";
import type React from "react";
import { IsLicensedInfo } from "@/book-edit/components/Metadata/BookMetadataEditor";

export type LicensedToggleProps = {
  value: boolean | undefined;
  onChange: (value: boolean | undefined) => void;
};

export const LicensedToggle: React.FC<LicensedToggleProps> = ({
  value,
  onChange,
}) => {
  return (
    <div className="m-0 inline-flex items-center gap-2">
      <Checkbox
        checked={!!value}
        onCheckedChange={(checked) => onChange(checked === true || undefined)}
        aria-label={m.search_tooltips_licensed()}
      />
      <IsLicensedInfo tooltipTitle={m.search_tooltips_licensed()} />
    </div>
  );
};
