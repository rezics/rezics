/**
 * React hook around the editor draft atom family.
 *
 * Provides a typed API that (1) hides the key serialization from callers
 * and (2) exposes imperative helpers for the dialog (add language, remove
 * language, set translation field, mark clean, etc.).
 */

import { useAtom } from "jotai";
import { useCallback, useMemo } from "react";
import {
  emptyTranslationDraft,
  type PinboardEditorDraft,
  type PinboardEditorTranslationDraft,
  type PinboardKey,
} from "../models";
import {
  editorDraftAtomFamily,
  serializeEditorDraftKey,
} from "../states/editorDraftAtom";

export interface UseEditorDraftInput {
  realmUnitId: string;
  pinboardKey: PinboardKey;
  unitId: string | null;
}

export function useEditorDraft(input: UseEditorDraftInput) {
  const key = useMemo(
    () =>
      serializeEditorDraftKey({
        realmUnitId: input.realmUnitId,
        pinboardKey: input.pinboardKey,
        unitId: input.unitId,
      }),
    [input.realmUnitId, input.pinboardKey, input.unitId],
  );

  const atom = useMemo(() => editorDraftAtomFamily(key), [key]);
  const [draft, setDraft] = useAtom(atom);

  const init = useCallback(
    (initial: PinboardEditorDraft) => {
      setDraft(initial);
    },
    [setDraft],
  );

  const reset = useCallback(() => {
    setDraft(null);
  }, [setDraft]);

  const setTranslationField = useCallback(
    (
      language: string,
      field: keyof Omit<PinboardEditorTranslationDraft, "language">,
      value: string,
    ) => {
      setDraft((prev) => {
        if (!prev) return prev;
        const next = prev.translations.map((t) =>
          t.language === language ? { ...t, [field]: value } : t,
        );
        return { ...prev, translations: next, dirty: true };
      });
    },
    [setDraft],
  );

  const addLanguage = useCallback(
    (language: string) => {
      setDraft((prev) => {
        if (!prev) return prev;
        if (prev.translations.some((t) => t.language === language)) return prev;
        return {
          ...prev,
          translations: [...prev.translations, emptyTranslationDraft(language)],
          removedLanguages: prev.removedLanguages.filter(
            (l) => l !== language,
          ),
          dirty: true,
        };
      });
    },
    [setDraft],
  );

  const removeLanguage = useCallback(
    (language: string) => {
      setDraft((prev) => {
        if (!prev) return prev;
        if (language === prev.defaultLanguage) return prev;
        if (!prev.translations.some((t) => t.language === language))
          return prev;
        return {
          ...prev,
          translations: prev.translations.filter(
            (t) => t.language !== language,
          ),
          removedLanguages: prev.removedLanguages.includes(language)
            ? prev.removedLanguages
            : [...prev.removedLanguages, language],
          dirty: true,
        };
      });
    },
    [setDraft],
  );

  const markClean = useCallback(() => {
    setDraft((prev) => (prev ? { ...prev, dirty: false } : prev));
  }, [setDraft]);

  return {
    draft,
    setDraft,
    init,
    reset,
    setTranslationField,
    addLanguage,
    removeLanguage,
    markClean,
  };
}
