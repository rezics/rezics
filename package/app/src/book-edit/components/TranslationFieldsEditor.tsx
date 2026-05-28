import { useTranslation } from "@rezics/i18n/react";
import type React from "react";
import { RezicsMarkdownEditor } from "@/shared/ui/RezicsMarkdownEditor";
import type { TranslationDraft } from "../hooks/useBookTranslationEditor";

export interface TranslationFieldsEditorProps {
  draft: TranslationDraft;
  onChange: <K extends keyof TranslationDraft>(
    key: K,
    value: TranslationDraft[K],
  ) => void;
  disabled?: boolean;
  afterTitleSlot?: React.ReactNode;
}

export const TranslationFieldsEditor: React.FC<
  TranslationFieldsEditorProps
> = ({ draft, onChange, disabled, afterTitleSlot }) => {
  const { t } = useTranslation(["book", "page"]);
return (
    <div className="flex flex-col gap-5">
      <div className="space-y-1">
        <label className="text-sm" htmlFor="tr-title">
          {t("book:fields_title")}
        </label>
        <input
          id="tr-title"
          value={draft.title}
          onChange={(e) => onChange("title", e.target.value)}
          disabled={disabled}
          className="w-full border-b border-input bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground transition-colors disabled:opacity-50"
        />
        {afterTitleSlot}
      </div>

      <div className="space-y-1">
        <label className="text-sm" htmlFor="tr-subtitle">
          {t("page:book_edit_info_translation_fields_subtitle")}
        </label>
        <input
          id="tr-subtitle"
          value={draft.subtitle}
          onChange={(e) => onChange("subtitle", e.target.value)}
          disabled={disabled}
          className="w-full border-b border-input bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground transition-colors disabled:opacity-50"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm" htmlFor="tr-summary">
          {t("page:book_edit_info_translation_fields_summary")}
        </label>
        <input
          id="tr-summary"
          value={draft.summary}
          onChange={(e) => onChange("summary", e.target.value)}
          disabled={disabled}
          className="w-full border-b border-input bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground transition-colors disabled:opacity-50"
        />
      </div>

      <div className="space-y-1">
        <span className="text-sm">{t("book:description")}</span>
        <RezicsMarkdownEditor
          value={draft.description}
          onChange={(value) => onChange("description", value)}
        />
      </div>
    </div>
  );
};
