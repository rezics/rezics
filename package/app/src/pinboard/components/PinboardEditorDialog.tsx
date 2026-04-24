import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import {
  useCreatePinboardEntry,
  useUpdatePinboardEntry,
} from "@rezics/api/pinboard";
import type {
  CreatePinboardEntryBody,
  PinboardKey,
  PinboardTranslationInput,
  UpdatePinboardEntryBody,
} from "@rezics/contract";
import { LANGUAGES } from "@rezics/contract";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useEditorDraft } from "../hooks/useEditorDraft";
import {
  emptyTranslationDraft,
  findTranslationDraft,
  isDraftValid,
  type PinboardEditorDraft,
  type PinboardEditorTranslationDraft,
} from "../models";
import { LanguageTabs } from "./LanguageTabs";

const ALL_LANGUAGES = Object.values(LANGUAGES) as string[];

interface PinboardEditorDialogProps {
  open: boolean;
  onClose: () => void;
  realmUnitId: string;
  pinboardKey: PinboardKey;
  /** When present, the dialog runs in edit mode; otherwise, create mode. */
  initial?: {
    unitId: string;
    defaultLanguage: string;
    translations: PinboardEditorTranslationDraft[];
  };
}

/**
 * Composite create/edit modal for a pinboard entry. Delegates per-language
 * state to `useEditorDraft` and composite saves to the `@rezics/api`
 * create / update hooks. Guards against unsaved-change dismiss.
 */
export const PinboardEditorDialog: React.FC<PinboardEditorDialogProps> = ({
  open,
  onClose,
  realmUnitId,
  pinboardKey,
  initial,
}) => {
  const { t, i18n } = useTranslation();
  const isEditing = Boolean(initial);
  const unitId = initial?.unitId ?? null;

  const {
    draft,
    init,
    reset,
    setTranslationField,
    addLanguage,
    removeLanguage,
    markClean,
  } = useEditorDraft({ realmUnitId, pinboardKey, unitId });

  const [activeLang, setActiveLang] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (draft && draft.realmUnitId === realmUnitId && draft.unitId === unitId) {
      setActiveLang((cur) => cur ?? draft.defaultLanguage);
      return;
    }
    const defaultLanguage =
      initial?.defaultLanguage ??
      (i18n.language && ALL_LANGUAGES.includes(i18n.language)
        ? i18n.language
        : LANGUAGES.EN);
    const initialDraft: PinboardEditorDraft = {
      unitId,
      pinboardKey,
      realmUnitId,
      defaultLanguage,
      translations:
        initial?.translations && initial.translations.length > 0
          ? initial.translations
          : [emptyTranslationDraft(defaultLanguage)],
      removedLanguages: [],
      dirty: false,
    };
    init(initialDraft);
    setActiveLang(initialDraft.defaultLanguage);
  }, [
    open,
    draft,
    initial,
    realmUnitId,
    pinboardKey,
    unitId,
    i18n.language,
    init,
  ]);

  const createMut = useCreatePinboardEntry();
  const updateMut = useUpdatePinboardEntry();
  const pending = createMut.isPending || updateMut.isPending;

  const availableToAdd = useMemo(() => {
    if (!draft) return [] as string[];
    return ALL_LANGUAGES.filter(
      (l) => !draft.translations.some((td) => td.language === l),
    );
  }, [draft]);

  const activeTranslation = useMemo(() => {
    if (!draft || !activeLang) return null;
    return findTranslationDraft(draft, activeLang) ?? null;
  }, [draft, activeLang]);

  const handleClose = useCallback(() => {
    if (pending) return;
    if (draft?.dirty) {
      setConfirmDiscard(true);
      return;
    }
    reset();
    onClose();
  }, [draft?.dirty, pending, reset, onClose]);

  const handleDiscardConfirmed = useCallback(() => {
    setConfirmDiscard(false);
    reset();
    onClose();
  }, [reset, onClose]);

  const handleSave = useCallback(async () => {
    if (!draft) return;
    if (!isDraftValid(draft)) {
      toast.error(t("pinboard.editor.errors.missing_default_title"));
      return;
    }

    const translations: PinboardTranslationInput[] = draft.translations.map(
      (td) => ({
        language: td.language as PinboardTranslationInput["language"],
        title: td.title.trim() || undefined,
        subtitle: td.subtitle.trim() || undefined,
        summary: td.summary.trim() || undefined,
        description: td.description.trim() || undefined,
        body: td.body.trim() || undefined,
      }),
    );

    try {
      if (isEditing && unitId) {
        const input: UpdatePinboardEntryBody = {
          upsert: translations,
          remove:
            draft.removedLanguages.length > 0
              ? (draft.removedLanguages as UpdatePinboardEntryBody["remove"])
              : undefined,
        };
        await updateMut.mutateAsync({
          realmUnitId,
          pinboardKey,
          unitId,
          input,
        });
        toast.success(t("pinboard.editor.saved"));
      } else {
        const input: CreatePinboardEntryBody = {
          defaultLanguage:
            draft.defaultLanguage as CreatePinboardEntryBody["defaultLanguage"],
          translations,
        };
        await createMut.mutateAsync({
          realmUnitId,
          pinboardKey,
          input,
        });
        toast.success(t("pinboard.editor.created"));
      }
      markClean();
      reset();
      onClose();
    } catch (err) {
      toast.error(
        t("pinboard.editor.errors.save_failed", {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }, [
    draft,
    isEditing,
    unitId,
    realmUnitId,
    pinboardKey,
    createMut,
    updateMut,
    markClean,
    reset,
    onClose,
    t,
  ]);

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        maxWidth="md"
        aria-labelledby="pinboard-editor-title"
      >
        <DialogTitle id="pinboard-editor-title">
          {isEditing
            ? t("pinboard.editor.title_edit")
            : t("pinboard.editor.title_create")}
        </DialogTitle>
        <DialogContent dividers>
          {!draft ? (
            <DialogContentText>{t("common.loading")}</DialogContentText>
          ) : (
            <Stack spacing={2}>
              <LanguageTabs
                languages={draft.translations.map((td) => td.language)}
                defaultLanguage={draft.defaultLanguage}
                active={activeLang ?? draft.defaultLanguage}
                onChange={setActiveLang}
                availableToAdd={availableToAdd}
                onAdd={(lang) => {
                  addLanguage(lang);
                  setActiveLang(lang);
                }}
                onRemove={(lang) => {
                  removeLanguage(lang);
                  setActiveLang((cur) =>
                    cur === lang ? draft.defaultLanguage : cur,
                  );
                }}
              />
              {activeTranslation ? (
                <Stack spacing={1.5}>
                  <TextField
                    label={t("pinboard.editor.fields.title")}
                    value={activeTranslation.title}
                    onChange={(e) =>
                      setTranslationField(
                        activeTranslation.language,
                        "title",
                        e.target.value,
                      )
                    }
                    required={
                      activeTranslation.language === draft.defaultLanguage
                    }
                    inputProps={{ maxLength: 300 }}
                    fullWidth
                  />
                  <TextField
                    label={t("pinboard.editor.fields.subtitle")}
                    value={activeTranslation.subtitle}
                    onChange={(e) =>
                      setTranslationField(
                        activeTranslation.language,
                        "subtitle",
                        e.target.value,
                      )
                    }
                    inputProps={{ maxLength: 300 }}
                    fullWidth
                  />
                  <TextField
                    label={t("pinboard.editor.fields.summary")}
                    value={activeTranslation.summary}
                    onChange={(e) =>
                      setTranslationField(
                        activeTranslation.language,
                        "summary",
                        e.target.value,
                      )
                    }
                    inputProps={{ maxLength: 2000 }}
                    multiline
                    minRows={2}
                    fullWidth
                  />
                  <TextField
                    label={t("pinboard.editor.fields.body")}
                    value={activeTranslation.body}
                    onChange={(e) =>
                      setTranslationField(
                        activeTranslation.language,
                        "body",
                        e.target.value,
                      )
                    }
                    multiline
                    minRows={6}
                    fullWidth
                  />
                </Stack>
              ) : (
                <Alert severity="info">
                  {t("pinboard.editor.no_active_language")}
                </Alert>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={pending}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={pending || !draft}
          >
            {pending ? t("common.saving") : t("common.save")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        aria-labelledby="pinboard-discard-title"
      >
        <DialogTitle id="pinboard-discard-title">
          {t("pinboard.editor.discard_title")}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("pinboard.editor.discard_description")}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDiscard(false)}>
            {t("common.cancel")}
          </Button>
          <Button color="error" onClick={handleDiscardConfirmed}>
            {t("pinboard.editor.discard_confirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
