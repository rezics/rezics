import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import {
  useAppendRealmExtraMutation,
  useRemoveRealmExtraMutation,
} from "@rezics/api/realm/realm-extra.mutations";
import { unitApi } from "@rezics/api/unit/unit";
import { unitDetailQuery } from "@rezics/api/unit/unit.queries";
import {
  DEFAULT_LANGUAGE,
  type Language,
  normalizeLanguage,
  type RealmExtraListKey,
} from "@rezics/contract";
import { TranslationEditor, type TranslationEditorEntry } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PinboardEmptyState } from "../components/PinboardEmptyState";
import { PinboardErrorState } from "../components/PinboardErrorState";
import { PinboardReorderList } from "../components/PinboardReorderList";
import { PinboardSkeleton } from "../components/PinboardSkeleton";
import { StaleIdsBanner } from "../components/StaleIdsBanner";
import { usePinboardList } from "../hooks/usePinboard";
import type { PinboardEntryView, PinboardListKey } from "../models/types";
import { Plus as AddRoundedIcon } from "lucide-react";

export interface PinboardAdminSectionProps {
  realmUnitId: string;
  /** When true, the `announcement` tab is included alongside `pinboard`. */
  isDefaultRealm?: boolean;
}

/**
 * Tabbed admin surface. Shows one tab per Realm.extra list key available to
 * the caller (`pinboard` always; `announcement` only on the default realm).
 * Each tab renders the reorder/edit list, stale banner, create button, and
 * delegates to the editor dialog.
 */
export const PinboardAdminSection: React.FC<PinboardAdminSectionProps> = ({
  realmUnitId,
  isDefaultRealm,
}) => {
  const { t } = useTranslation();
  const availableKeys = useMemo<PinboardListKey[]>(
    () => (isDefaultRealm ? ["announcement", "pinboard"] : ["pinboard"]),
    [isDefaultRealm],
  );
  const [activeKey, setActiveKey] = useState<PinboardListKey>(availableKeys[0]);

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} mb={1}>
        {t("pinboard.admin.title")}
      </Typography>
      {availableKeys.length > 1 ? (
        <Tabs
          value={activeKey}
          onChange={(_, v) => setActiveKey(v as RealmExtraListKey)}
          sx={{ mb: 2 }}
          aria-label={t("pinboard.admin.tabs_aria")}
        >
          {availableKeys.map((key) => (
            <Tab
              key={key}
              value={key}
              label={t(`pinboard.admin.tabs.${key}`)}
            />
          ))}
        </Tabs>
      ) : null}

      <PinboardAdminBoard
        realmUnitId={realmUnitId}
        pinboardKey={activeKey}
      />
    </Box>
  );
};

interface PinboardAdminBoardProps {
  realmUnitId: string;
  pinboardKey: PinboardListKey;
}

const PinboardAdminBoard: React.FC<PinboardAdminBoardProps> = ({
  realmUnitId,
  pinboardKey,
}) => {
  const { t } = useTranslation();
  const { entries, staleIds, isLoading, isError, error, refetch } =
    usePinboardList({
      realmUnitId,
      pinboardKey,
      adminView: true,
    });

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PinboardEntryView | null>(
    null,
  );
  const [pendingRemove, setPendingRemove] =
    useState<PinboardEntryView | null>(null);
  const [removing, setRemoving] = useState(false);

  const append = useAppendRealmExtraMutation();
  const removeMut = useRemoveRealmExtraMutation();

  const openCreate = useCallback(() => {
    setEditingEntry(null);
    setEditorOpen(true);
  }, []);

  const openEdit = useCallback((entry: PinboardEntryView) => {
    setEditingEntry(entry);
    setEditorOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    setEditorOpen(false);
    setEditingEntry(null);
  }, []);

  const confirmRemove = useCallback(async () => {
    if (!pendingRemove) return;
    setRemoving(true);
    try {
      await removeMut.mutateAsync({
        realmId: realmUnitId,
        key: pinboardKey,
        unitId: pendingRemove.unitId,
      });
      toast.success(t("pinboard.admin.delete_done"));
      setPendingRemove(null);
    } catch (err) {
      toast.error(
        t("pinboard.admin.delete_failed", {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    } finally {
      setRemoving(false);
    }
  }, [removeMut, pendingRemove, realmUnitId, pinboardKey, t]);

  const handleCreate = useCallback(
    async (translations: TranslationEditorEntry[]) => {
      const created = await unitApi.create({
        type: "POST",
        defaultLanguage: toLanguage(translations[0]?.language) ?? DEFAULT_LANGUAGE,
        translations: translations.flatMap((tr) => {
          const language = toLanguage(tr.language);
          if (!language) return [];
          return [
            {
              language,
              title: tr.title,
              subtitle: tr.subtitle,
              summary: tr.summary,
              description: tr.description,
            },
          ];
        }),
      });
      await append.mutateAsync({
        realmId: realmUnitId,
        key: pinboardKey,
        unitId: created.id,
      });
      toast.success(t("pinboard.editor.created"));
      refetch();
    },
    [append, realmUnitId, pinboardKey, refetch, t],
  );

  const handleEditSave = useCallback(
    async (unitId: string, translations: TranslationEditorEntry[]) => {
      for (const tr of translations) {
        const language = toLanguage(tr.language);
        if (!language) continue;
        await unitApi.upsertTranslation(unitId, language, {
          title: tr.title,
          subtitle: tr.subtitle,
          summary: tr.summary,
          description: tr.description,
        });
      }
      toast.success(t("pinboard.editor.saved"));
      refetch();
    },
    [refetch, t],
  );

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="flex-end">
        <Button
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={openCreate}
        >
          {t("pinboard.admin.create")}
        </Button>
      </Stack>

      {staleIds.length > 0 ? (
        <StaleIdsBanner
          realmUnitId={realmUnitId}
          pinboardKey={pinboardKey}
          staleIds={staleIds}
          onCleaned={() => refetch()}
        />
      ) : null}

      {isLoading ? (
        <PinboardSkeleton rows={4} rowHeight={72} />
      ) : isError ? (
        <PinboardErrorState
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => refetch()}
        />
      ) : entries.length === 0 ? (
        <PinboardEmptyState />
      ) : (
        <PinboardReorderList
          realmUnitId={realmUnitId}
          pinboardKey={pinboardKey}
          entries={entries}
          staleIds={staleIds}
          onEdit={openEdit}
          onDelete={(entry) => setPendingRemove(entry)}
          onConflict={() => refetch()}
        />
      )}

      {editorOpen ? (
        <PinboardEntryEditorDialog
          open
          onClose={closeEditor}
          entry={editingEntry}
          onCreate={async (translations) => {
            await handleCreate(translations);
            closeEditor();
          }}
          onEdit={async (unitId, translations) => {
            await handleEditSave(unitId, translations);
            closeEditor();
          }}
        />
      ) : null}

      <Dialog
        open={pendingRemove !== null}
        onClose={() => setPendingRemove(null)}
        aria-labelledby="pinboard-delete-title"
      >
        <DialogTitle id="pinboard-delete-title">
          {t("pinboard.admin.delete_title")}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("pinboard.admin.delete_description", {
              title: pendingRemove?.title ?? "",
            })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingRemove(null)}>
            {t("common.cancel")}
          </Button>
          <Button color="error" onClick={confirmRemove} disabled={removing}>
            {t("common.delete")}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

interface PinboardEntryEditorDialogProps {
  open: boolean;
  onClose: () => void;
  entry: PinboardEntryView | null;
  onCreate: (translations: TranslationEditorEntry[]) => Promise<void>;
  onEdit: (
    unitId: string,
    translations: TranslationEditorEntry[],
  ) => Promise<void>;
}

/**
 * Editor dialog for create/edit. On edit, fetches the underlying Unit so all
 * existing translations populate `TranslationEditor`. On create, starts with
 * a single empty translation in the default language.
 */
const PinboardEntryEditorDialog: React.FC<PinboardEntryEditorDialogProps> = ({
  open,
  onClose,
  entry,
  onCreate,
  onEdit,
}) => {
  const { t } = useTranslation();
  const isEdit = entry !== null;
  const detailQuery = useQuery({
    ...unitDetailQuery(entry?.unitId ?? ""),
    enabled: isEdit && Boolean(entry?.unitId),
  });

  const initial = useMemo<TranslationEditorEntry[]>(() => {
    if (isEdit && detailQuery.data) {
      return (detailQuery.data.translations ?? []).map((tr) => ({
        language: tr.language,
        title: tr.title ?? "",
        subtitle: tr.subtitle ?? "",
        summary: tr.summary ?? "",
        description: tr.description ?? "",
      }));
    }
    return [{ language: DEFAULT_LANGUAGE }];
  }, [isEdit, detailQuery.data]);

  const [drafts, setDrafts] = useState<TranslationEditorEntry[]>(initial);
  const [saving, setSaving] = useState(false);

  // Sync drafts when initial changes (e.g., detail loads)
  useEffect(() => {
    setDrafts(initial);
  }, [initial]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      if (isEdit && entry) {
        await onEdit(entry.unitId, drafts);
      } else {
        await onCreate(drafts);
      }
    } catch (err) {
      toast.error(
        t("pinboard.editor.errors.save_failed", {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    } finally {
      setSaving(false);
    }
  }, [isEdit, entry, drafts, onCreate, onEdit, t]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      aria-labelledby="pinboard-editor-title"
    >
      <DialogTitle id="pinboard-editor-title">
        {isEdit
          ? t("pinboard.editor.title_edit")
          : t("pinboard.editor.title_create")}
      </DialogTitle>
      <DialogContent>
        {isEdit && detailQuery.isLoading ? (
          <PinboardSkeleton rows={3} rowHeight={48} />
        ) : (
          <TranslationEditor translations={drafts} onChange={setDrafts} />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          {t("common.cancel")}
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {t("common.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

function toLanguage(code: string | undefined): Language | null {
  if (!code) return null;
  return normalizeLanguage(code);
}
