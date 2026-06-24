import type { PostDTO } from "@rezics/contract";
import { useMemo } from "react";
import type { RezicsMarkdownEditorProps } from "@/shared/ui/RezicsMarkdownEditor";
import type { PostEditorSurfaceDraft } from "../models/postEditorSurface";
import { RootPostTranslationEditor } from "./RootPostTranslationEditor";

export type { PostEditorSurfaceDraft };

export interface PostEditorSurfaceProps {
  post?: PostDTO;
  language: string;
  defaultLanguage?: string | null;
  title: string;
  body: string;
  onLanguageChange: (language: string) => void;
  onTitleChange: (title: string) => void;
  onBodyChange: (body: string) => void;
  disabled?: boolean;
  titlePlaceholder?: string;
  resize?: RezicsMarkdownEditorProps["resize"];
  onSubmit?: RezicsMarkdownEditorProps["onSubmit"];
  onCancel?: RezicsMarkdownEditorProps["onCancel"];
  submitLabel?: RezicsMarkdownEditorProps["submitLabel"];
  submitDisabled?: RezicsMarkdownEditorProps["submitDisabled"];
  extraRight?: RezicsMarkdownEditorProps["extraRight"];
}

/**
 * Shared post authoring surface. Domain features add controls around this
 * component instead of making the post core import realm or review behavior.
 */
export function PostEditorSurface({
  post,
  language,
  defaultLanguage,
  title,
  body,
  onLanguageChange,
  onTitleChange,
  onBodyChange,
  disabled,
  titlePlaceholder,
  resize,
  onSubmit,
  onCancel,
  submitLabel,
  submitDisabled,
  extraRight,
}: PostEditorSurfaceProps) {
  const defaultResize = useMemo(
    () => ({ height: 260, minHeight: 180, maxHeight: 560 }),
    [],
  );

  return (
    <RootPostTranslationEditor
      post={post}
      language={language}
      defaultLanguage={defaultLanguage}
      title={title}
      body={body}
      onLanguageChange={onLanguageChange}
      onTitleChange={onTitleChange}
      onBodyChange={onBodyChange}
      disabled={disabled}
      titlePlaceholder={titlePlaceholder}
      resize={resize ?? defaultResize}
      onSubmit={onSubmit}
      onCancel={onCancel}
      submitLabel={submitLabel}
      submitDisabled={submitDisabled}
      extraRight={extraRight}
    />
  );
}
