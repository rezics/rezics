import { Typography } from "@mui/material";
import { RezicsMarkdownEditor } from "@rezics/ui/editor";
import type React from "react";
import { useTranslation } from "react-i18next";
import type { TranslationDraft } from "../hooks/useBookTranslationEditor";

export interface TranslationFieldsEditorProps {
  draft: TranslationDraft;
  onChange: <K extends keyof TranslationDraft>(
    key: K,
    value: TranslationDraft[K],
  ) => void;
  disabled?: boolean;
}

export const TranslationFieldsEditor: React.FC<TranslationFieldsEditorProps> = ({
  draft,
  onChange,
  disabled,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-1">
        <Typography variant="body2" component="label" htmlFor="tr-title">
          {t("book.fields.title")}
        </Typography>
        <input
          id="tr-title"
          value={draft.title}
          onChange={(e) => onChange("title", e.target.value)}
          disabled={disabled}
          className="w-full border-b border-input bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground transition-colors disabled:opacity-50"
        />
      </div>

      <div className="space-y-1">
        <Typography variant="body2" component="label" htmlFor="tr-subtitle">
          {t("page.book_edit.info.translation.fields.subtitle")}
        </Typography>
        <input
          id="tr-subtitle"
          value={draft.subtitle}
          onChange={(e) => onChange("subtitle", e.target.value)}
          disabled={disabled}
          className="w-full border-b border-input bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground transition-colors disabled:opacity-50"
        />
      </div>

      <div className="space-y-1">
        <Typography variant="body2" component="label" htmlFor="tr-summary">
          {t("page.book_edit.info.translation.fields.summary")}
        </Typography>
        <input
          id="tr-summary"
          value={draft.summary}
          onChange={(e) => onChange("summary", e.target.value)}
          disabled={disabled}
          className="w-full border-b border-input bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground transition-colors disabled:opacity-50"
        />
      </div>

      <div className="space-y-1">
        <Typography variant="body2" component="label">
          {t("book.description")}
        </Typography>
        <RezicsMarkdownEditor
          value={draft.description}
          onChange={(value) => onChange("description", value)}
        />
      </div>
    </div>
  );
};
