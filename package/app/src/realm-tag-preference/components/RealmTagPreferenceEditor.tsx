import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { realmDetailQuery, realmSearchQuery } from "@rezics/api/realm/realm";
import type {
  RealmResponse,
  RealmTagDisplayTarget,
  UserSettings,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Button, Input, Label } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { GripVerticalIcon, PlusIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { useSaveRealmTagPreferences } from "../hooks/useSaveRealmTagPreferences";
import {
  addRealmToTarget,
  createRealmTagPreferenceDraft,
  pruneEmptyRealmTagPreferenceDraft,
  type RealmTagPreferenceDraft,
  removeRealmFromTarget,
  reorderRealmForTarget,
  setMaxDisplayForTarget,
} from "../models/realmTagPreferenceDraft";
import {
  REALM_TAG_DISPLAY_TARGETS,
  realmTagDisplayTargetLabel,
} from "../models/realmTagPreferenceTargets";

export interface RealmTagPreferenceEditorProps {
  settings?: UserSettings | null;
}

interface TargetEditorProps {
  target: RealmTagDisplayTarget;
  draft: RealmTagPreferenceDraft;
  onChange: (draft: RealmTagPreferenceDraft) => void;
  disabled?: boolean;
}

interface RealmSearchAddProps {
  target: RealmTagDisplayTarget;
  draft: RealmTagPreferenceDraft;
  onChange: (draft: RealmTagPreferenceDraft) => void;
  disabled?: boolean;
}

interface SortableRealmItemProps {
  realmId: string;
  onRemove: () => void;
  disabled?: boolean;
}

function realmTitle(realm: RealmResponse | undefined, fallback: string) {
  return realm?.title ?? realm?.slug ?? fallback;
}

function SortableRealmItem({
  realmId,
  onRemove,
  disabled,
}: SortableRealmItemProps) {
  const { t } = useTranslation(["common", "settings"]);
  const readContext = useReadLanguageContext();
  const realmQuery = useQuery({
    ...realmDetailQuery(realmId, {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    }),
    enabled: readContext.ready && Boolean(realmId),
  });
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: realmId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex min-w-0 items-center gap-2 rounded-md bg-surface-subtle px-2 py-1"
    >
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-10 w-10 shrink-0 cursor-grab touch-none"
        disabled={disabled}
        aria-label={t("settings:preferences_drag_handle")}
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon size={14} />
      </Button>
      <span className="min-w-0 flex-1 truncate text-sm leading-ui">
        {realmQuery.isLoading
          ? t("settings:realm_tag_preference_realm_loading")
          : realmTitle(realmQuery.data, realmId)}
      </span>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-10 w-10 shrink-0"
        onClick={onRemove}
        disabled={disabled}
        aria-label={t("settings:realm_tag_preference_remove_realm")}
      >
        <XIcon size={14} />
      </Button>
    </div>
  );
}

function RealmSearchAdd({
  target,
  draft,
  onChange,
  disabled,
}: RealmSearchAddProps) {
  const { t } = useTranslation(["common", "settings"]);
  const readContext = useReadLanguageContext();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), 200);
  const search = useQuery({
    ...realmSearchQuery(debouncedQuery, {
      limit: 8,
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    }),
    enabled: readContext.ready && debouncedQuery.length > 0,
  });
  const selected = new Set(draft[target].realmIds);
  const results = (search.data?.realms ?? []).filter(
    (realm) => !selected.has(realm.unitId),
  );

  const handleAdd = (realmId: string) => {
    onChange(addRealmToTarget(draft, target, realmId));
    setQuery("");
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Input
        value={query}
        disabled={disabled}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("settings:realm_tag_preference_search_placeholder")}
      />
      {search.isFetching && debouncedQuery ? (
        <div className="flex justify-center py-2">
          <Spinner />
        </div>
      ) : null}
      {debouncedQuery && results.length > 0 ? (
        <div className="max-h-48 overflow-y-auto rounded-md border border-border-whisper bg-surface-canvas p-1">
          {results.map((realm) => (
            <button
              key={realm.unitId}
              type="button"
              className="flex w-full min-w-0 items-center gap-2 rounded-sm px-2 py-2 text-left text-sm leading-ui hover:bg-surface-subtle"
              onClick={() => handleAdd(realm.unitId)}
              disabled={disabled}
            >
              <PlusIcon className="h-4 w-4 shrink-0 text-text-secondary" />
              <span className="min-w-0 flex-1 truncate">
                {realmTitle(realm, realm.unitId)}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {debouncedQuery && !search.isFetching && results.length === 0 ? (
        <p className="text-sm leading-ui text-text-secondary">
          {t("settings:realm_tag_preference_no_matches")}
        </p>
      ) : null}
    </div>
  );
}

function TargetEditor({
  target,
  draft,
  onChange,
  disabled,
}: TargetEditorProps) {
  const { t } = useTranslation(["common", "settings"]);
  const preference = draft[target];
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const inputId = `realm-tag-max-${target}`;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onChange(
      reorderRealmForTarget(draft, target, String(active.id), String(over.id)),
    );
  };

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-md bg-surface-elevated p-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium leading-ui">
            {realmTagDisplayTargetLabel(t, target)}
          </h3>
          <p className="text-sm leading-ui text-text-secondary">
            {t("settings:realm_tag_preference_target_hint")}
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-1 sm:w-36">
          <Label htmlFor={inputId}>
            {t("settings:realm_tag_preference_max_display")}
          </Label>
          <Input
            id={inputId}
            type="number"
            min={0}
            value={preference.maxDisplay ?? ""}
            disabled={disabled}
            onChange={(event) => {
              const raw = event.target.value;
              onChange(
                setMaxDisplayForTarget(
                  draft,
                  target,
                  raw === "" ? undefined : Math.max(0, Number(raw)),
                ),
              );
            }}
          />
        </div>
      </div>
      {preference.realmIds.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={preference.realmIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex min-w-0 flex-col gap-2">
              {preference.realmIds.map((realmId) => (
                <SortableRealmItem
                  key={realmId}
                  realmId={realmId}
                  disabled={disabled}
                  onRemove={() =>
                    onChange(removeRealmFromTarget(draft, target, realmId))
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <p className="text-sm leading-ui text-text-secondary">
          {t("settings:realm_tag_preference_target_empty")}
        </p>
      )}
      <RealmSearchAdd
        target={target}
        draft={draft}
        onChange={onChange}
        disabled={disabled}
      />
    </section>
  );
}

/**
 * 帳號設定頁的完整 realm tag preference editor：每個 catalog target 都有
 * realm 搜尋、已選清單 hydration、移除、max display 與拖曳排序。
 *
 * Mobile (<640px):
 * +--------------------+
 * | Books              |
 * | [max]              |
 * | [grip] Realm [x]   |
 * | [search realm]     |
 * | Games              |
 * | [max]              |
 * | [search realm]     |
 * | [Save]             |
 * +--------------------+
 *
 * Tablet (640-1023px):
 * +----------------------------+
 * | Books                 [max]|
 * | [grip] Realm title [x]     |
 * | [search realm]             |
 * | Games                 [max]|
 * | [search realm]             |
 * |                      [Save]|
 * +----------------------------+
 *
 * Desktop (1024-1535px):
 * +--------------------------------+
 * | Books                    [max] |
 * | [grip] Realm title       [x]   |
 * | [search realm]                 |
 * | Media                    [max] |
 * | [search realm]                 |
 * |                         [Save] |
 * +--------------------------------+
 *
 * Ultra-wide (>=1536px):
 * +--------------------------------------+
 * | Books                          [max] |
 * | [grip] Long realm title        [x]   |
 * | [search realm]                       |
 * | Games                          [max] |
 * | [search realm]                       |
 * |                               [Save] |
 * +--------------------------------------+
 */
export function RealmTagPreferenceEditor({
  settings,
}: RealmTagPreferenceEditorProps) {
  const { t } = useTranslation(["common", "settings"]);
  const initialDraft = useMemo(
    () => createRealmTagPreferenceDraft(settings),
    [settings],
  );
  const [draft, setDraft] = useState(initialDraft);
  const save = useSaveRealmTagPreferences({
    onSuccess: () => toast.success(t("settings:realm_tag_preference_saved")),
  });

  const handleSave = () => {
    save.saveRealmTagPreferences(pruneEmptyRealmTagPreferenceDraft(draft));
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {REALM_TAG_DISPLAY_TARGETS.map((target) => (
        <TargetEditor
          key={target}
          target={target}
          draft={draft}
          onChange={setDraft}
          disabled={save.isPending}
        />
      ))}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={save.isPending}>
          {t("common:save")}
        </Button>
      </div>
    </div>
  );
}
