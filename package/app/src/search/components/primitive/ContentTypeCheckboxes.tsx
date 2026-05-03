import { Checkbox } from "@rezics/ui/shadcn";
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
          <label
            key={type}
            className="m-0 inline-flex items-center gap-2 cursor-pointer"
          >
            <Checkbox
              checked={value.includes(type)}
              onCheckedChange={(checked) => toggle(type, checked === true)}
            />
            <span className="text-sm">{type}</span>
          </label>
        ))}
      </div>
    </div>
  );
};
