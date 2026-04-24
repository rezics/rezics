import AddRoundedIcon from "@mui/icons-material/AddRounded";
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
import { useDeletePinboardEntry } from "@rezics/api/pinboard";
import type { PinboardKey } from "@rezics/contract";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PinboardEditorDialog } from "../components/PinboardEditorDialog";
import { PinboardEmptyState } from "../components/PinboardEmptyState";
import { PinboardErrorState } from "../components/PinboardErrorState";
import { PinboardReorderList } from "../components/PinboardReorderList";
import { PinboardSkeleton } from "../components/PinboardSkeleton";
import { StaleIdsBanner } from "../components/StaleIdsBanner";
import { usePinboardDetail, usePinboardList } from "../hooks/usePinboard";
import type {
  PinboardEditorTranslationDraft,
  PinboardEntryDTO,
} from "../models/types";

export interface PinboardAdminSectionProps {
  realmUnitId: string;
  /** When true, the `announcement` tab is included alongside `pinned`. */
  isDefaultRealm?: boolean;
}

/**
 * Tabbed admin surface. Shows one tab per pinboard key available to the
 * caller (`pinned` always; `announcement` only on the default realm).
 * Each tab renders the reorder/edit list, stale banner, create button,
 * and delegates to the editor dialog.
 */
export const PinboardAdminSection: React.FC<PinboardAdminSectionProps> = ({
  realmUnitId,
  isDefaultRealm,
}) => {
  const { t } = useTranslation();
  const availableKeys = useMemo<PinboardKey[]>(
    () => (isDefaultRealm ? ["announcement", "pinned"] : ["pinned"]),
    [isDefaultRealm],
  );
  const [activeKey, setActiveKey] = useState<PinboardKey>(availableKeys[0]);

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} mb={1}>
        {t("pinboard.admin.title")}
      </Typography>
      {availableKeys.length > 1 ? (
        <Tabs
          value={activeKey}
          onChange={(_, v) => setActiveKey(v as PinboardKey)}
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
  pinboardKey: PinboardKey;
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
  const [editingEntry, setEditingEntry] = useState<PinboardEntryDTO | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] = useState<PinboardEntryDTO | null>(
    null,
  );

  const openCreate = useCallback(() => {
    setEditingEntry(null);
    setEditorOpen(true);
  }, []);

  const openEdit = useCallback((entry: PinboardEntryDTO) => {
    setEditingEntry(entry);
    setEditorOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    setEditorOpen(false);
    setEditingEntry(null);
  }, []);

  const deleteMut = useDeletePinboardEntry();

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    try {
      await deleteMut.mutateAsync({
        realmUnitId,
        pinboardKey,
        unitId: pendingDelete.unitId,
      });
      toast.success(t("pinboard.admin.delete_done"));
      setPendingDelete(null);
    } catch (err) {
      toast.error(
        t("pinboard.admin.delete_failed", {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }, [deleteMut, pendingDelete, realmUnitId, pinboardKey, t]);

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
          onDelete={(entry) => setPendingDelete(entry)}
          onConflict={() => refetch()}
        />
      )}

      {editorOpen ? (
        <EditorLoader
          realmUnitId={realmUnitId}
          pinboardKey={pinboardKey}
          entry={editingEntry}
          onClose={closeEditor}
        />
      ) : null}

      <Dialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        aria-labelledby="pinboard-delete-title"
      >
        <DialogTitle id="pinboard-delete-title">
          {t("pinboard.admin.delete_title")}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("pinboard.admin.delete_description", {
              title: pendingDelete?.title ?? "",
            })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)}>
            {t("common.cancel")}
          </Button>
          <Button
            color="error"
            onClick={confirmDelete}
            disabled={deleteMut.isPending}
          >
            {t("common.delete")}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

interface EditorLoaderProps {
  realmUnitId: string;
  pinboardKey: PinboardKey;
  entry: PinboardEntryDTO | null;
  onClose: () => void;
}

/**
 * Thin wrapper that fetches the full detail (which includes body + all
 * supported languages) for the edit case so the dialog can populate
 * every translation tab. Create case skips the fetch.
 */
const EditorLoader: React.FC<EditorLoaderProps> = ({
  realmUnitId,
  pinboardKey,
  entry,
  onClose,
}) => {
  // For edit: load the detail in the entry's default language first
  // to expose the full body; additional languages will be fetched on
  // demand if needed (MVP treats the dialog as single-load for now).
  const detail = usePinboardDetail({
    realmUnitId,
    pinboardKey,
    unitId: entry?.unitId ?? "",
    language: entry?.defaultLanguage ?? entry?.language,
    enabled: entry !== null,
  });

  if (!entry) {
    return (
      <PinboardEditorDialog
        open
        onClose={onClose}
        realmUnitId={realmUnitId}
        pinboardKey={pinboardKey}
      />
    );
  }

  if (detail.isLoading) return null;

  const detailEntry = detail.entry;
  const defaultLanguage =
    detailEntry?.defaultLanguage ?? entry.defaultLanguage ?? entry.language;
  const translations: PinboardEditorTranslationDraft[] = detailEntry
    ? [
        {
          language: detailEntry.language,
          title: detailEntry.title ?? "",
          subtitle: detailEntry.subtitle ?? "",
          summary: detailEntry.summary ?? "",
          description: detailEntry.description ?? "",
          body: detailEntry.body ?? "",
        },
      ]
    : [
        {
          language: entry.language,
          title: entry.title ?? "",
          subtitle: "",
          summary: entry.summary ?? "",
          description: "",
          body: "",
        },
      ];

  return (
    <PinboardEditorDialog
      open
      onClose={onClose}
      realmUnitId={realmUnitId}
      pinboardKey={pinboardKey}
      initial={{
        unitId: entry.unitId,
        defaultLanguage: defaultLanguage ?? entry.language,
        translations,
      }}
    />
  );
};
