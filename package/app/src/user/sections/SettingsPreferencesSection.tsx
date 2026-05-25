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
import { LANGUAGE_META, LANGUAGES, type Language } from "@rezics/contract";
import { Spinner } from "@rezics/ui";
import {
  Alert,
  AlertDescription,
  Button,
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
import { useMessage } from "@rezics/i18n/react";
import {
  common_add,
  settings_preferences_add_language,
  settings_preferences_content_rating_description,
  settings_preferences_content_rating_title,
  settings_preferences_drag_handle,
  settings_preferences_language_description,
  settings_preferences_language_empty,
  settings_preferences_language_saved,
  settings_preferences_language_title,
  settings_preferences_realm_tags_description,
  settings_preferences_realm_tags_empty,
  settings_preferences_realm_tags_meta,
  settings_preferences_realm_tags_title,
  settings_preferences_remove_language,
} from "@rezics/i18n/messages";
const m = {
  common_add,
  settings_preferences_add_language,
  settings_preferences_content_rating_description,
  settings_preferences_content_rating_title,
  settings_preferences_drag_handle,
  settings_preferences_language_description,
  settings_preferences_language_empty,
  settings_preferences_language_saved,
  settings_preferences_language_title,
  settings_preferences_realm_tags_description,
  settings_preferences_realm_tags_empty,
  settings_preferences_realm_tags_meta,
  settings_preferences_realm_tags_title,
  settings_preferences_remove_language,
};

const i18nMessages = {
  common_add,
  settings_preferences_add_language,
  settings_preferences_content_rating_description,
  settings_preferences_content_rating_title,
  settings_preferences_drag_handle,
  settings_preferences_language_description,
  settings_preferences_language_empty,
  settings_preferences_language_saved,
  settings_preferences_language_title,
  settings_preferences_realm_tags_description,
  settings_preferences_realm_tags_empty,
  settings_preferences_realm_tags_meta,
  settings_preferences_realm_tags_title,
  settings_preferences_remove_language,
};

const SUPPORTED_LANGUAGES = Object.values(LANGUAGES);

function getLanguageLabel(code: string): string {
  return LANGUAGE_META[code as Language]?.nativeName ?? code;
}

type SortableLangItemProps = {
  code: string;
  onRemove: (code: string) => void;
  disabled?: boolean;
};

const SortableLangItem: FC<SortableLangItemProps> = ({
  code,
  onRemove,
  disabled,
}) => {
  const m = useMessage(i18nMessages);
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
        aria-label={m.settings_preferences_drag_handle()}
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
        aria-label={m.settings_preferences_remove_language({ code })}
      >
        <XIcon size={14} />
      </Button>
    </div>
  );
};

export const SettingsPreferencesSection: FC = () => {
  const m = useMessage(i18nMessages);
  useRequireAuth();

  const { data: settings, isLoading: settingsLoading } = useQuery(
    userQueries.settings(),
  );

  const updateSettings = useUpdateSettingsMutation();

  const [langSuccess, setLangSuccess] = useState(false);

  const preferredLangs: string[] = settings?.preferredLanguages ?? [];
  const availableToAdd = SUPPORTED_LANGUAGES.filter(
    (language) => !preferredLangs.includes(language),
  );
  const [addPick, setAddPick] = useState<string>("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const persistOrder = (next: string[]) => {
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

  const handleAddLang = (code: string) => {
    if (!code || preferredLangs.includes(code)) return;
    persistOrder([...preferredLangs, code]);
    setAddPick("");
  };

  const handleRemoveLang = (code: string) => {
    persistOrder(preferredLangs.filter((c) => c !== code));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = preferredLangs.indexOf(String(active.id));
    const newIndex = preferredLangs.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    persistOrder(arrayMove(preferredLangs, oldIndex, newIndex));
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
        title={m.settings_preferences_language_title()}
        description={m.settings_preferences_language_description()}
      >
        {langSuccess && (
          <Alert className="mb-3 text-success-text">
            <AlertDescription>
              {m.settings_preferences_language_saved()}
            </AlertDescription>
          </Alert>
        )}

        {preferredLangs.length === 0 ? (
          <p className="text-sm text-text-secondary mb-4">
            {m.settings_preferences_language_empty()}
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
            <Select value={addPick} onValueChange={setAddPick}>
              <SelectTrigger className="min-w-[220px] h-9">
                <SelectValue
                  placeholder={m.settings_preferences_add_language()}
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
              {m.common_add()}
            </Button>
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        title={m.settings_preferences_content_rating_title()}
        description={m.settings_preferences_content_rating_description()}
      >
        <ContentRatingPreferences />
      </SettingsSection>

      <SettingsSection
        title={m.settings_preferences_realm_tags_title()}
        description={m.settings_preferences_realm_tags_description()}
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
                    {m.settings_preferences_realm_tags_meta({
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
            {m.settings_preferences_realm_tags_empty()}
          </p>
        )}
      </SettingsSection>
    </div>
  );
};
