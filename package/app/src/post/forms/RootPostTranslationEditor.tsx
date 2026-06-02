import { contentTranslationQueries } from "@rezics/api/content-translation/content-translation";
import { mainMarkdownSource, type PostDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Input } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { RezicsMarkdownEditorProps } from "@/shared/ui/RezicsMarkdownEditor";
import { RezicsMarkdownEditor } from "@/shared/ui/RezicsMarkdownEditor";
import {
  AddUnitTranslationLanguageDialog,
  UnitTranslationLanguageBar,
} from "@/unit";

export type RootPostTranslationDraft = {
  language: string;
  defaultLanguage?: string | null;
  title: string;
  body: string;
};

export interface RootPostTranslationEditorProps {
  post?: PostDTO;
  language: string;
  title: string;
  body: string;
  onLanguageChange: (language: string) => void;
  onTitleChange: (title: string) => void;
  onBodyChange: (body: string) => void;
  onDraftChange?: (draft: RootPostTranslationDraft) => void;
  disabled?: boolean;
  titlePlaceholder?: string;
  resize?: RezicsMarkdownEditorProps["resize"];
}

type DraftMap = Record<string, { title: string; body: string }>;

function readBody(content: unknown): string {
  return mainMarkdownSource(content) ?? "";
}

function uniq(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function RootPostTranslationEditor({
  post,
  language,
  defaultLanguage,
  title,
  body,
  onLanguageChange,
  onTitleChange,
  onBodyChange,
  onDraftChange,
  disabled,
  titlePlaceholder,
  resize,
}: RootPostTranslationEditorProps) {
  const { t } = useTranslation(["common", "community"]);
  const [addLanguageOpen, setAddLanguageOpen] = useState(false);
  const [drafts, setDrafts] = useState<DraftMap>(() => ({
    [language]: { title, body },
  }));
  const { data: contentTranslationList } = useQuery(
    contentTranslationQueries.list(post?.unitId ?? ""),
  );

  const translationBodies = useMemo(() => {
    const map = new Map<string, string>();
    for (const translation of contentTranslationList?.translations ?? []) {
      map.set(translation.language, readBody(translation.content));
    }
    return map;
  }, [contentTranslationList]);

  const existingLanguages = useMemo(
    () =>
      uniq([
        language,
        ...(contentTranslationList?.translations ?? []).map(
          (translation) => translation.language,
        ),
      ]),
    [contentTranslationList, language],
  );

  useEffect(() => {
    setDrafts((current) => {
      const seeded = { ...current };
      for (const [translationLanguage, translationBody] of translationBodies) {
        seeded[translationLanguage] ??= { title: "", body: translationBody };
      }
      seeded[language] = { title, body };
      return seeded;
    });
  }, [body, language, title, translationBodies]);

  const selectLanguage = (nextLanguage: string) => {
    setDrafts((current) => ({
      ...current,
      [language]: { title, body },
    }));
    const nextDraft =
      drafts[nextLanguage] ??
      (defaultLanguage === nextLanguage
        ? { title: post.title ?? "", body: readBody(post.content) }
        : { title: "", body: translationBodies.get(nextLanguage) ?? "" });
    onLanguageChange(nextLanguage);
    onTitleChange(nextDraft.title);
    onBodyChange(nextDraft.body);
    onDraftChange?.({ language: nextLanguage, ...nextDraft });
  };

  const addLanguage = (nextLanguage: string) => {
    setAddLanguageOpen(false);
    selectLanguage(nextLanguage);
  };

  const handleTitleChange = (nextTitle: string) => {
    onTitleChange(nextTitle);
    onDraftChange?.({ language, title: nextTitle, body });
  };

  const handleBodyChange = (nextBody: string) => {
    onBodyChange(nextBody);
    onDraftChange?.({ language, title, body: nextBody });
  };

  return (
    <div className="flex flex-col gap-3">
      <UnitTranslationLanguageBar
        existingLanguages={existingLanguages}
        selectedLanguage={language}
        defaultLanguage={defaultLanguage}
        onSelect={selectLanguage}
        onAddClick={() => setAddLanguageOpen(true)}
        label={t("community:post_languages")}
        addLabel={t("common:add_translation")}
      />
      <Input
        value={title}
        onChange={(event) => handleTitleChange(event.target.value)}
        placeholder={titlePlaceholder ?? t("community:post_title_placeholder")}
        disabled={disabled}
      />
      <RezicsMarkdownEditor
        value={body}
        onChange={handleBodyChange}
        resize={resize}
      />
      <AddUnitTranslationLanguageDialog
        open={addLanguageOpen}
        existingLanguages={existingLanguages}
        onClose={() => setAddLanguageOpen(false)}
        onSubmit={addLanguage}
        title={t("common:add_translation")}
        languageLabel={t("common:language")}
        cancelLabel={t("common:cancel")}
        submitLabel={t("common:add")}
      />
    </div>
  );
}
