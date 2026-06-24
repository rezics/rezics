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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useUpdateSettingsMutation } from "@rezics/contract/api/user/user.mutations";
import { userQueries } from "@rezics/contract/api/user/user.queries";
import {
  CONTENT_LANGUAGE_SLUGS,
  type ContentLanguage,
  LANGUAGE_META,
  normalizeContentLanguage,
  type UserSubscriptionListSort,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { GripVerticalIcon, XIcon } from "lucide-react";
import { type FC, useState } from "react";
import { RealmTagPreferenceEditor } from "@/realm-tag-preference";
import { ContentRatingPreferences } from "@/user/components/ContentRatingPreferences";
import { SettingsSection } from "@/user/components/SettingsSection";
import {
  normalizeSubscriptionListSort,
  SUBSCRIPTION_LIST_SORTS,
} from "@/user/models/subscriptionListOrdering";
import { useRequireAuth } from "@/user/pages/useAuth";

type SortableLangItemProps = {
  code: ContentLanguage;
  onRemove: (code: ContentLanguage) => void;
  disabled?: boolean;
};

const SUPPORTED_LANGUAGES: ContentLanguage[] = CONTENT_LANGUAGE_SLUGS;

function subscriptionListSortLabel(
  t: (key: string) => string,
  sort: UserSubscriptionListSort,
): string {
  switch (sort) {
    case "manualDesc":
      return t("settings:preferences_subscription_lists_sort_manualDesc");
    case "addedDesc":
      return t("settings:preferences_subscription_lists_sort_addedDesc");
    case "addedAsc":
      return t("settings:preferences_subscription_lists_sort_addedAsc");
    default:
      return t("settings:preferences_subscription_lists_sort_manualAsc");
  }
}

function getLanguageLabel(code: ContentLanguage): string {
  return LANGUAGE_META[code].nativeName;
}

const SortableLangItem: FC<SortableLangItemProps> = ({
  code,
  onRemove,
  disabled,
}) => {
  const { t } = useTranslation(["common", "settings"]);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: code });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-2 py-1 rounded bg-surface-elevated"
    >
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-10 w-10 cursor-grab touch-none"
        {...attributes}
        {...listeners}
        aria-label={t("settings:preferences_drag_handle")}
      >
        <GripVerticalIcon size={14} />
      </Button>
      <span className="text-sm flex-1">{getLanguageLabel(code)}</span>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-10 w-10"
        onClick={() => onRemove(code)}
        disabled={disabled}
        aria-label={t("settings:preferences_remove_language", { code })}
      >
        <XIcon size={14} />
      </Button>
    </div>
  );
};

/**
 * 偏好部分：管理首选语言、内容评级偏好、审核设置和领域标签显示选项。
 * 用户可以拖放排序首选语言、设置内容评级过滤器、启用领域管理模式，以及配置标签显示。
 *
 * Desktop (≥1024px):
 * ┌─────────────────────────────────────┐
 * │ Language Preferences       Saved!   │
 * │ [Grip] English    [X]               │
 * │ [Grip] Spanish    [X]               │
 * │ [Grip] French     [X]               │
 * │                                     │
 * │ Add Language: [Select...]  [Add]   │
 * │                                     │
 * │ Content Rating Preferences          │
 * │ [Rating controls...]                │
 * │                                     │
 * │ Moderation Settings                │
 * │ [X] Realm Manage Mode Default      │
 * │     ...description...              │
 * │                                     │
 * │ Realm Tag Preferences               │
 * │ realm1: max 5 [realm1, realm2]     │
 * └─────────────────────────────────────┘
 *
 * Tablet (768px-1023px):
 * ┌──────────────────────────────┐
 * │ Language Preferences  [Saved]│
 * │ [Grip] English    [X]        │
 * │ [Grip] Spanish    [X]        │
 * │                              │
 * │ Add Language:                │
 * │ [Select...]       [Add]      │
 * │                              │
 * │ Content Rating                │
 * │ [Rating controls...]         │
 * │                              │
 * │ Moderation Settings          │
 * │ [X] Manage Mode Default      │
 * │                              │
 * │ Realm Tag Preferences        │
 * │ realm1: max 5 [...]          │
 * └──────────────────────────────┘
 *
 * Mobile (480px-767px):
 * ┌──────────────────┐
 * │Languages [Saved] │
 * │[Grip]English[X]  │
 * │[Grip]Spanish[X]  │
 * │                  │
 * │Add: [Select] [+] │
 * │                  │
 * │Content Rating    │
 * │[controls...]     │
 * │                  │
 * │Moderation        │
 * │[X]Manage Mode    │
 * │                  │
 * │Realm Tags        │
 * │realm1: max 5     │
 * └──────────────────┘
 *
 * Small Mobile (<480px):
 * ┌──────────┐
 * │Languages │
 * │[G]En [X] │
 * │[G]Es [X] │
 * │[Select]  │
 * │[Add]     │
 * │          │
 * │Ratings   │
 * │[...]     │
 * │          │
 * │[X]Manage │
 * │          │
 * │Tags:em   │
 * │realm1    │
 * └──────────┘
 */
export const SettingsPreferencesSection: FC = () => {
  // TODO(openspec-retired): a keyword-vocabulary preference (PATCH /users/me/keywords) was specified but never built.
  // TODO(openspec-retired)：曾规划过关键词词表偏好（PATCH /users/me/keywords），但从未实现。
  const { t } = useTranslation(["common", "settings"]);
  useRequireAuth();

  const { data: settings, isLoading: settingsLoading } = useQuery(
    userQueries.settings(),
  );

  const updateSettings = useUpdateSettingsMutation();

  const [langSuccess, setLangSuccess] = useState(false);
  const [moderationSuccess, setModerationSuccess] = useState(false);
  const [subscriptionListSuccess, setSubscriptionListSuccess] = useState(false);

  const preferredLangs: ContentLanguage[] = settings?.preferredLanguages ?? [];
  const availableToAdd = SUPPORTED_LANGUAGES.filter(
    (language) => !preferredLangs.includes(language),
  );
  const [addPick, setAddPick] = useState<ContentLanguage | "">("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const persistOrder = (next: ContentLanguage[]) => {
    updateSettings.mutate(
      { preferredLanguages: next },
      {
        onSuccess: () => {
          setLangSuccess(true);
          setTimeout(() => setLangSuccess(false), 2000);
        },
      },
    );
  };

  const handleAddLang = (code: ContentLanguage | "") => {
    if (!code || preferredLangs.includes(code)) return;
    persistOrder([...preferredLangs, code]);
    setAddPick("");
  };

  const handleRemoveLang = (code: ContentLanguage) => {
    persistOrder(preferredLangs.filter((c) => c !== code));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeLanguage = normalizeContentLanguage(String(active.id));
    const overLanguage = normalizeContentLanguage(String(over.id));
    if (!activeLanguage || !overLanguage) return;
    const oldIndex = preferredLangs.indexOf(activeLanguage);
    const newIndex = preferredLangs.indexOf(overLanguage);
    if (oldIndex < 0 || newIndex < 0) return;
    persistOrder(arrayMove(preferredLangs, oldIndex, newIndex));
  };

  const handleManageModeDefaultChange = (next: boolean) => {
    updateSettings.mutate(
      { moderation: { realmManageModeDefault: next } },
      {
        onSuccess: () => {
          setModerationSuccess(true);
          setTimeout(() => setModerationSuccess(false), 2000);
        },
      },
    );
  };

  const handleSubscriptionListSortChange = (
    list: "zones" | "realms",
    value: string,
  ) => {
    updateSettings.mutate(
      {
        subscriptionLists: {
          [list]: { defaultSort: normalizeSubscriptionListSort(value) },
        },
      },
      {
        onSuccess: () => {
          setSubscriptionListSuccess(true);
          setTimeout(() => setSubscriptionListSuccess(false), 2000);
        },
      },
    );
  };

  if (settingsLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <SettingsSection
        title={t("settings:preferences_language_title")}
        description={t("settings:preferences_language_description")}
      >
        {langSuccess && (
          <Alert className="mb-3 text-success-text">
            <AlertDescription>
              {t("settings:preferences_language_saved")}
            </AlertDescription>
          </Alert>
        )}

        {preferredLangs.length === 0 ? (
          <p className="text-sm text-text-secondary mb-4">
            {t("settings:preferences_language_empty")}
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={preferredLangs}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-2 mb-4">
                {preferredLangs.map((code) => (
                  <SortableLangItem
                    key={code}
                    code={code}
                    onRemove={handleRemoveLang}
                    disabled={updateSettings.isPending}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {availableToAdd.length > 0 && (
          <div className="flex flex-row flex-wrap items-center gap-2">
            <Select
              value={addPick}
              onValueChange={(value) =>
                setAddPick(normalizeContentLanguage(value) ?? "")
              }
            >
              <SelectTrigger className="min-w-0 flex-1 h-9">
                <SelectValue
                  placeholder={t("settings:preferences_add_language")}
                />
              </SelectTrigger>
              <SelectContent>
                {availableToAdd.map((language) => (
                  <SelectItem key={language} value={language}>
                    {getLanguageLabel(language)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAddLang(addPick)}
              disabled={!addPick || updateSettings.isPending}
            >
              {t("common:add")}
            </Button>
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        title={t("settings:preferences_content_rating_title")}
        description={t("settings:preferences_content_rating_description")}
      >
        <ContentRatingPreferences />
      </SettingsSection>

      <SettingsSection
        title={t("settings:preferences_moderation_title")}
        description={t("settings:preferences_moderation_description")}
      >
        {moderationSuccess && (
          <Alert className="mb-3 text-success-text">
            <AlertDescription>
              {t("settings:preferences_moderation_saved")}
            </AlertDescription>
          </Alert>
        )}
        <label
          htmlFor="settings-realm-manage-mode-default"
          className="flex cursor-pointer items-start gap-3"
        >
          <Checkbox
            id="settings-realm-manage-mode-default"
            checked={settings?.moderation?.realmManageModeDefault !== false}
            disabled={updateSettings.isPending}
            onCheckedChange={(checked) =>
              handleManageModeDefaultChange(checked === true)
            }
            className="mt-0.5"
          />
          <span className="flex flex-col">
            <span className="text-sm font-medium">
              {t("settings:preferences_moderation_manage_mode")}
            </span>
            <span className="text-sm text-text-secondary">
              {t("settings:preferences_moderation_manage_mode_hint")}
            </span>
          </span>
        </label>
      </SettingsSection>

      <SettingsSection
        title={t("settings:preferences_subscription_lists_title")}
        description={t("settings:preferences_subscription_lists_description")}
      >
        {subscriptionListSuccess && (
          <Alert className="mb-3 text-success-text">
            <AlertDescription>
              {t("settings:preferences_subscription_lists_saved")}
            </AlertDescription>
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2">
            <label
              htmlFor="settings-zone-list-default-sort"
              className="text-sm font-medium leading-ui"
            >
              {t("settings:preferences_subscription_lists_zones")}
            </label>
            <Select
              value={String(
                normalizeSubscriptionListSort(
                  settings?.subscriptionLists?.zones?.defaultSort,
                ),
              )}
              onValueChange={(value) =>
                handleSubscriptionListSortChange("zones", value)
              }
              disabled={updateSettings.isPending}
            >
              <SelectTrigger
                id="settings-zone-list-default-sort"
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUBSCRIPTION_LIST_SORTS.map((sort) => (
                  <SelectItem key={String(sort)} value={String(sort)}>
                    {subscriptionListSortLabel(t, sort)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <label
              htmlFor="settings-realm-list-default-sort"
              className="text-sm font-medium leading-ui"
            >
              {t("settings:preferences_subscription_lists_realms")}
            </label>
            <Select
              value={String(
                normalizeSubscriptionListSort(
                  settings?.subscriptionLists?.realms?.defaultSort,
                ),
              )}
              onValueChange={(value) =>
                handleSubscriptionListSortChange("realms", value)
              }
              disabled={updateSettings.isPending}
            >
              <SelectTrigger
                id="settings-realm-list-default-sort"
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUBSCRIPTION_LIST_SORTS.map((sort) => (
                  <SelectItem key={String(sort)} value={String(sort)}>
                    {subscriptionListSortLabel(t, sort)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="mt-3 text-sm leading-ui text-text-secondary">
          {t("settings:preferences_subscription_lists_hint")}
        </p>
      </SettingsSection>

      <SettingsSection
        title={t("settings:preferences_realm_tags_title")}
        description={t("settings:preferences_realm_tags_description")}
        divider={false}
      >
        <RealmTagPreferenceEditor settings={settings} />
      </SettingsSection>
    </div>
  );
};
