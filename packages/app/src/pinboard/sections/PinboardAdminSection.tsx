import {
  useAppendPinboardMutation,
  useRemovePinboardMutation,
} from "@rezics/contract/api/pinboard/pinboard.mutations";
import { useCreateUnitMutation } from "@rezics/contract/api/unit/unit.mutations";
import {
  DEFAULT_LANGUAGE,
  type Language,
  markdownContentDoc,
  normalizeLanguage,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { TranslationEditor, type TranslationEditorEntry } from "@rezics/ui";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@rezics/ui/shadcn";
import { Plus as AddRoundedIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PinboardEmptyState } from "../components/PinboardEmptyState";
import { PinboardErrorState } from "../components/PinboardErrorState";
import { PinboardReorderList } from "../components/PinboardReorderList";
import { PinboardSkeleton } from "../components/PinboardSkeleton";
import { StaleIdsBanner } from "../components/StaleIdsBanner";
import { usePinboardList } from "../hooks/usePinboard";
import type { PinboardEntryView, PinboardListKey } from "../models/types";

export interface PinboardAdminSectionProps {
  realmUnitId: string;
}

/**
 * Pinboard admin surface for the realm home Pinboard.
 * Realm 首页 Pinboard 的管理界面。
 */
export const PinboardAdminSection: React.FC<PinboardAdminSectionProps> = ({
  realmUnitId,
}) => {
  const { t } = useTranslation(["common", "entity"]);

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">
        {t("entity:pinboard_admin_title")}
      </h2>
      <PinboardAdminBoard realmUnitId={realmUnitId} pinboardKey="home" />
    </div>
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
  const { t } = useTranslation(["common", "entity"]);
  const { entries, staleIds, isLoading, isError, error, refetch } =
    usePinboardList({
      realmUnitId,
      pinboardKey,
      adminView: true,
    });

  const [editorOpen, setEditorOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<PinboardEntryView | null>(
    null,
  );
  const [removing, setRemoving] = useState(false);

  const append = useAppendPinboardMutation();
  const removeMut = useRemovePinboardMutation();
  const createUnit = useCreateUnitMutation();

  const openCreate = () => {
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
  };

  const confirmRemove = async () => {
    if (!pendingRemove) return;
    setRemoving(true);
    try {
      await removeMut.mutateAsync({
        realmId: realmUnitId,
        key: pinboardKey,
        unitId: pendingRemove.unitId,
      });
      toast.success(t("entity:pinboard_admin_delete_done"));
      setPendingRemove(null);
    } catch (err) {
      toast.error(
        t("entity:pinboard_admin_delete_failed", {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    } finally {
      setRemoving(false);
    }
  };

  const handleCreate = async (translations: TranslationEditorEntry[]) => {
    try {
      const created = await createUnit.mutateAsync({
        type: "POST",
        translations: translations.flatMap((tr) => {
          const language = toLanguage(tr.language);
          if (!language) return [];
          return [
            {
              language,
              title: tr.title,
              subtitle: tr.subtitle,
              summary: tr.summary,
              description: tr.description
                ? markdownContentDoc(tr.description)
                : undefined,
            },
          ];
        }),
      });
      await append.mutateAsync({
        realmId: realmUnitId,
        key: pinboardKey,
        unitId: created.id,
      });
      toast.success(t("entity:pinboard_editor_created"));
      refetch();
    } catch (err) {
      toast.error(
        t("entity:pinboard_admin_create_failed", {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-row justify-end">
        <Button onClick={openCreate}>
          <AddRoundedIcon className="h-4 w-4 mr-1" />
          {t("entity:pinboard_admin_create")}
        </Button>
      </div>

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
          onDelete={(entry) => setPendingRemove(entry)}
          onConflict={() => refetch()}
        />
      )}

      {editorOpen ? (
        <PinboardEntryEditorDialog
          open
          onClose={closeEditor}
          onCreate={async (translations) => {
            await handleCreate(translations);
            closeEditor();
          }}
        />
      ) : null}

      <Dialog
        open={pendingRemove !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemove(null);
        }}
      >
        <DialogContent aria-labelledby="pinboard-delete-title">
          <DialogHeader>
            <DialogTitle id="pinboard-delete-title">
              {t("entity:pinboard_admin_delete_title")}
            </DialogTitle>
            <DialogDescription>
              {t("entity:pinboard_admin_delete_description", {
                title: pendingRemove?.title ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingRemove(null)}>
              {t("common:cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRemove}
              disabled={removing}
            >
              {t("common:delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface PinboardEntryEditorDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (translations: TranslationEditorEntry[]) => Promise<void>;
}

/**
 * Editor dialog for creating pinboard entries. Existing entries open their
 * public page, where content-specific editing and permissions live.
 * 用于创建 pinboard 条目的编辑器对话框。已存在的条目会打开其公共页面，
 * 内容相关的编辑和权限都在那里。
 */
const PinboardEntryEditorDialog: React.FC<PinboardEntryEditorDialogProps> = ({
  open,
  onClose,
  onCreate,
}) => {
  const { t } = useTranslation(["common", "entity"]);

  const initial = useMemo<TranslationEditorEntry[]>(() => {
    return [{ language: DEFAULT_LANGUAGE }];
  }, []);

  const [drafts, setDrafts] = useState<TranslationEditorEntry[]>(initial);
  const [saving, setSaving] = useState(false);

  // Keep the dialog draft resettable if its initial create template changes.
  // 当初始创建模板变化时，保持对话框草稿可被重置。
  useEffect(() => {
    setDrafts(initial);
  }, [initial]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onCreate(drafts);
    } catch (err) {
      toast.error(
        t("entity:pinboard_editor_errors_save_failed", {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent
        className="sm:max-w-2xl"
        aria-labelledby="pinboard-editor-title"
      >
        <DialogHeader>
          <DialogTitle id="pinboard-editor-title">
            {t("entity:pinboard_editor_title_create")}
          </DialogTitle>
        </DialogHeader>
        <TranslationEditor translations={drafts} onChange={setDrafts} />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t("common:cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {t("common:save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

function toLanguage(code: string | undefined): Language | null {
  if (!code) return null;
  return normalizeLanguage(code);
}
