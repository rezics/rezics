import { getI18nRuntime } from "@rezics/i18n/runtime";

const i18nMessages = {
  pinboard_admin_tabs_announcement: () =>
    getI18nRuntime().i18n.t("entity:pinboard_admin_tabs_announcement"),
  pinboard_admin_tabs_pinboard: () =>
    getI18nRuntime().i18n.t("entity:pinboard_admin_tabs_pinboard"),
} as const;

import {
  useAppendRealmExtraMutation,
  useRemoveRealmExtraMutation,
} from "@rezics/api/realm/realm-extra.mutations";
import { unitApi } from "@rezics/api/unit/unit";
import {
  DEFAULT_LANGUAGE,
  type Language,
  markdownContentDoc,
  normalizeLanguage,
  type RealmExtraListKey,
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
  Tabs,
  TabsList,
  TabsTrigger,
} from "@rezics/ui/shadcn";
import { Plus as AddRoundedIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  /** When true, the `announcement` tab is included alongside `pinboard`. */
  isDefaultRealm?: boolean;
}

const PINBOARD_ADMIN_TAB_LABEL = {
  announcement: i18nMessages.pinboard_admin_tabs_announcement,
  pinboard: i18nMessages.pinboard_admin_tabs_pinboard,
} as const satisfies Record<PinboardListKey, () => string>;

/**
 * Tabbed admin surface. Shows one tab per Realm.extra list key available to
 * the caller (`pinboard` always; `announcement` only on the default realm).
 * Each tab renders the reorder/open list, stale banner, create button, and
 * delegates to the editor dialog.
 */
export const PinboardAdminSection: React.FC<PinboardAdminSectionProps> = ({
  realmUnitId,
  isDefaultRealm,
}) => {
  const { t } = useTranslation(["common", "entity"]);
  const availableKeys = useMemo<PinboardListKey[]>(
    () => (isDefaultRealm ? ["announcement", "pinboard"] : ["pinboard"]),
    [isDefaultRealm],
  );
  const [activeKey, setActiveKey] = useState<PinboardListKey>(availableKeys[0]);

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">
        {t("entity:pinboard_admin_title")}
      </h2>
      {availableKeys.length > 1 ? (
        <Tabs
          value={activeKey}
          onValueChange={(v) => setActiveKey(v as RealmExtraListKey)}
          aria-label={t("entity:pinboard_admin_tabs_aria")}
          className="mb-4"
        >
          <TabsList>
            {availableKeys.map((key) => (
              <TabsTrigger key={key} value={key}>
                {PINBOARD_ADMIN_TAB_LABEL[key]()}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}

      <PinboardAdminBoard realmUnitId={realmUnitId} pinboardKey={activeKey} />
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

  const append = useAppendRealmExtraMutation();
  const removeMut = useRemoveRealmExtraMutation();

  const openCreate = useCallback(() => {
    setEditorOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    setEditorOpen(false);
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
  }, [removeMut, pendingRemove, realmUnitId, pinboardKey, t]);

  const handleCreate = useCallback(
    async (translations: TranslationEditorEntry[]) => {
      const created = await unitApi.create({
        type: "POST",
        defaultLanguage:
          toLanguage(translations[0]?.language) ?? DEFAULT_LANGUAGE,
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
    },
    [append, realmUnitId, pinboardKey, refetch, t],
  );

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
  useEffect(() => {
    setDrafts(initial);
  }, [initial]);

  const handleSave = useCallback(async () => {
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
  }, [drafts, onCreate, t]);

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
