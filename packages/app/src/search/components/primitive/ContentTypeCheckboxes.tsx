import { useTranslation } from "@rezics/i18n/react";
import { Checkbox } from "@rezics/ui/shadcn";
import type React from "react";

export const CONTENT_TYPES = [
  "BOOK",
  "GAME",
  "MEDIA",
  "SHELF",
  "POST",
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

const CONTENT_TYPE_I18N_KEYS: Record<ContentType, string> = {
  BOOK: "content_type_book",
  GAME: "content_type_game",
  MEDIA: "content_type_media",
  SHELF: "content_type_shelf",
  POST: "content_type_post",
};

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
  const { t } = useTranslation("search");

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
      {label && <span className="text-sm font-medium opacity-60">{label}</span>}
      <div className="flex flex-wrap gap-1">
        {options.map((type) => (
          <div key={type} className="m-0 inline-flex items-center gap-2">
            <Checkbox
              checked={value.includes(type)}
              onCheckedChange={(checked) => toggle(type, checked === true)}
              aria-label={t(CONTENT_TYPE_I18N_KEYS[type as ContentType])}
            />
            <span className="text-sm">
              {t(CONTENT_TYPE_I18N_KEYS[type as ContentType])}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
