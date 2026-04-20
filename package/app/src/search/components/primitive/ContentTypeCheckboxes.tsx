import { Checkbox, FormControlLabel } from "@mui/material";
import type React from "react";

export const CONTENT_TYPES = ["BOOK", "GAME", "MEDIA", "SHELF", "POST"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export type ContentTypeCheckboxesProps = {
  value: string[];
  onChange: (types: string[]) => void;
  options?: readonly string[];
  label?: string;
};

export const ContentTypeCheckboxes: React.FC<ContentTypeCheckboxesProps> = ({
  value,
  onChange,
  options = CONTENT_TYPES,
  label,
}) => {
  const toggle = (type: string, checked: boolean) => {
    if (checked) {
      if (value.includes(type)) return;
      onChange([...value, type]);
    } else {
      onChange(value.filter((t) => t !== type));
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <span className="text-sm font-medium opacity-60">{label}</span>
      )}
      <div className="flex flex-wrap gap-1">
        {options.map((type) => (
          <FormControlLabel
            key={type}
            control={
              <Checkbox
                size="small"
                checked={value.includes(type)}
                onChange={(e) => toggle(type, e.target.checked)}
              />
            }
            label={type}
            className="m-0"
          />
        ))}
      </div>
    </div>
  );
};
