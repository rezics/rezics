import { unitQueries } from "@rezics/api/unit/unit";
import { mainMarkdownSource, type PostDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Input } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RezicsMarkdownEditorProps } from "@/shared/ui/RezicsMarkdownEditor";
import { RezicsMarkdownEditor } from "@/shared/ui/RezicsMarkdownEditor";
import {
  AddUnitTranslationLanguageDialog,
  UnitTranslationLanguageBar,
} from "@/unit";
import { rootPostEditorLanguages } from "../models/rootPostTranslationEditorLanguages";

export type RootPostTranslationDraft = {
  language: string;
  defaultLanguage?: string | null;
  title: string;
  body: string;
};

export interface RootPostTranslationEditorProps {
  post?: PostDTO;
  language: string;
  defaultLanguage?: string | null;
  title: string;
  body: string;
  onLanguageChange: (language: string) => void;
  onTitleChange: (title: string) => void;
  onBodyChange: (body: string) => void;
  onDraftChange?: (draft: RootPostTranslationDraft) => void;
  disabled?: boolean;
  titlePlaceholder?: string;
  resize?: RezicsMarkdownEditorProps["resize"];
  onSubmit?: RezicsMarkdownEditorProps["onSubmit"];
  onCancel?: RezicsMarkdownEditorProps["onCancel"];
  submitLabel?: RezicsMarkdownEditorProps["submitLabel"];
  submitDisabled?: RezicsMarkdownEditorProps["submitDisabled"];
  extraRight?: RezicsMarkdownEditorProps["extraRight"];
}

type DraftMap = Record<string, { title: string; body: string }>;

function readBody(content: unknown): string {
  return mainMarkdownSource(content) ?? "";
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
  onSubmit,
  onCancel,
  submitLabel,
  submitDisabled,
  extraRight,
}: RootPostTranslationEditorProps) {
  const { t } = useTranslation(["common", "community"]);
  const [addLanguageOpen, setAddLanguageOpen] = useState(false);
  const [draftLanguages, setDraftLanguages] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<DraftMap>(() => ({
    [language]: { title, body },
  }));
  const contentQuery = useMemo(
    () => ({
      explicitLanguage: language,
      appLocale: defaultLanguage ?? undefined,
    }),
    [defaultLanguage, language],
  );
  const { data: languageContent } = useQuery({
    ...unitQueries.languageContent(post?.unitId ?? "", contentQuery),
    enabled: Boolean(post?.unitId),
  });
  const lastAppliedResolvedContent = useRef<string | null>(null);

  const resolvedLanguage = languageContent?.resolvedLanguage ?? language;
  const resolvedTitle = languageContent?.title ?? "";
  const resolvedBody = readBody(languageContent?.content);

  const existingLanguages = useMemo(
    () =>
      rootPostEditorLanguages({
        supportLanguages: languageContent?.supportLanguages,
        draftLanguages,
        fallbackLanguage: post ? undefined : language,
      }),
    [draftLanguages, language, languageContent?.supportLanguages, post],
  );

  useEffect(() => {
    if (!post || !languageContent?.resolvedLanguage) return;
    const contentKey = [
      post.unitId,
      language,
      languageContent.resolvedLanguage,
      resolvedTitle,
      resolvedBody,
    ].join(":");
    if (lastAppliedResolvedContent.current === contentKey) return;
    if (draftLanguages.includes(languageContent.resolvedLanguage)) return;
    lastAppliedResolvedContent.current = contentKey;

    onLanguageChange(languageContent.resolvedLanguage);
    onTitleChange(resolvedTitle);
    onBodyChange(resolvedBody);
    onDraftChange?.({
      language: languageContent.resolvedLanguage,
      title: resolvedTitle,
      body: resolvedBody,
    });
  }, [
    draftLanguages,
    language,
    languageContent,
    onBodyChange,
    onDraftChange,
    onLanguageChange,
    onTitleChange,
    post,
    resolvedBody,
    resolvedTitle,
  ]);

  useEffect(() => {
    if (!resolvedLanguage) return;
    setDrafts((current) => {
      const seeded = { ...current };
      seeded[resolvedLanguage] ??= { title: resolvedTitle, body: resolvedBody };
      seeded[language] = { title, body };
      return seeded;
    });
  }, [body, language, resolvedBody, resolvedLanguage, resolvedTitle, title]);

  const selectLanguage = (nextLanguage: string) => {
    setDrafts((current) => ({
      ...current,
      [language]: { title, body },
    }));
    const nextDraft =
      drafts[nextLanguage] ??
      (resolvedLanguage === nextLanguage
        ? { title: resolvedTitle, body: resolvedBody }
        : { title: "", body: "" });
    onLanguageChange(nextLanguage);
    onTitleChange(nextDraft.title);
    onBodyChange(nextDraft.body);
    onDraftChange?.({ language: nextLanguage, ...nextDraft });
  };

  const addLanguage = (nextLanguage: string) => {
    setAddLanguageOpen(false);
    setDraftLanguages((current) =>
      current.includes(nextLanguage) ? current : [...current, nextLanguage],
    );
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
        defaultLanguage={
          languageContent?.supportLanguages.find((item) => item.isPrimary)
            ?.language
        }
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
        onSubmit={onSubmit}
        onCancel={onCancel}
        submitLabel={submitLabel}
        submitDisabled={submitDisabled}
        extraRight={extraRight}
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
