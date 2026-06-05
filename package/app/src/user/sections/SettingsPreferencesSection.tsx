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
import { useUpdateSettingsMutation } from "@rezics/api/user/user.mutations";
import { userQueries } from "@rezics/api/user/user.queries";
import {
  LANGUAGE_META,
  LANGUAGES,
  type Language,
  normalizeLanguage,
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
import { ContentRatingPreferences } from "@/user/components/ContentRatingPreferences";
import { SettingsSection } from "@/user/components/SettingsSection";
import { useRequireAuth } from "@/user/pages/useAuth";

const SUPPORTED_LANGUAGES: Language[] = Object.values(LANGUAGES);

function getLanguageLabel(code: Language): string {
  return LANGUAGE_META[code].nativeName;
}

type SortableLangItemProps = {
  code: Language;
  onRemove: (code: Language) => void;
  disabled?: boolean;
};

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
        className="h-7 w-7 cursor-grab touch-none"
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
        className="h-7 w-7"
        onClick={() => onRemove(code)}
        disabled={disabled}
        aria-label={t("settings:preferences_remove_language", { code })}
      >
        <XIcon size={14} />
      </Button>
    </div>
  );
};

export const SettingsPreferencesSection: FC = () => {
  // TODO(openspec-retired): a keyword-vocabulary preference (PATCH /users/me/keywords) was specified but never built.
  const { t } = useTranslation(["common", "settings"]);
  useRequireAuth();

  const { data: settings, isLoading: settingsLoading } = useQuery(
    userQueries.settings(),
  );

  const updateSettings = useUpdateSettingsMutation();

  const [langSuccess, setLangSuccess] = useState(false);
  const [moderationSuccess, setModerationSuccess] = useState(false);

  const preferredLangs: Language[] = settings?.preferredLanguages ?? [];
  const availableToAdd = SUPPORTED_LANGUAGES.filter(
    (language) => !preferredLangs.includes(language),
  );
  const [addPick, setAddPick] = useState<Language | "">("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const persistOrder = (next: Language[]) => {
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

  const handleAddLang = (code: Language | "") => {
    if (!code || preferredLangs.includes(code)) return;
    persistOrder([...preferredLangs, code]);
    setAddPick("");
  };

  const handleRemoveLang = (code: Language) => {
    persistOrder(preferredLangs.filter((c) => c !== code));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeLanguage = normalizeLanguage(String(active.id));
    const overLanguage = normalizeLanguage(String(over.id));
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
          <div className="flex flex-row items-center gap-2">
            <Select
              value={addPick}
              onValueChange={(value) =>
                setAddPick(normalizeLanguage(value) ?? "")
              }
            >
              <SelectTrigger className="min-w-[220px] h-9">
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
        title="Realm moderation"
        description="Choose whether realm manage mode starts enabled on feeds you moderate."
      >
        {moderationSuccess && (
          <Alert className="mb-3 text-success-text">
            <AlertDescription>Moderation preference saved.</AlertDescription>
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
              Start realm manage mode enabled
            </span>
            <span className="text-sm text-text-secondary">
              Per-realm changes are kept only for the current visit.
            </span>
          </span>
        </label>
      </SettingsSection>

      <SettingsSection
        title={t("settings:preferences_realm_tags_title")}
        description={t("settings:preferences_realm_tags_description")}
        divider={false}
      >
        {settings?.realmTagPreferences &&
        Object.keys(settings.realmTagPreferences).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(settings.realmTagPreferences).map(
              ([realm, pref]) => (
                <div key={realm} className="flex items-center gap-2">
                  <span className="text-sm font-medium">{realm}</span>
                  <span className="text-xs text-text-secondary">
                    {t("settings:preferences_realm_tags_meta", {
                      max: pref.maxDisplay,
                      realms: pref.realmIds.join(", "),
                    })}
                  </span>
                </div>
              ),
            )}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">
            {t("settings:preferences_realm_tags_empty")}
          </p>
        )}
      </SettingsSection>
    </div>
  );
};
