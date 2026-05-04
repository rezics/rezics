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

const SUPPORTED_LANGUAGES = [
  { code: "zh-hant", label: "Traditional Chinese" },
  { code: "zh-hans", label: "Simplified Chinese" },
  { code: "en", label: "English" },
  { code: "ja", label: "Japanese" },
  { code: "de", label: "German" },
] as const;

const LANG_LABELS: Record<string, string> = Object.fromEntries(
  SUPPORTED_LANGUAGES.map((l) => [l.code, l.label]),
);

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
        aria-label="drag handle"
      >
        <GripVerticalIcon size={14} />
      </Button>
      <span className="text-sm flex-1">{LANG_LABELS[code] ?? code}</span>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        onClick={() => onRemove(code)}
        disabled={disabled}
        aria-label={`remove ${code}`}
      >
        <XIcon size={14} />
      </Button>
    </div>
  );
};

export const SettingsPreferencesSection: FC = () => {
  useRequireAuth();

  const { data: settings, isLoading: settingsLoading } = useQuery(
    userQueries.settings(),
  );

  const updateSettings = useUpdateSettingsMutation();

  const [langSuccess, setLangSuccess] = useState(false);

  const preferredLangs: string[] = settings?.preferredLanguages ?? [];
  const availableToAdd = SUPPORTED_LANGUAGES.filter(
    (l) => !preferredLangs.includes(l.code),
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
        title="Language Preferences"
        description="Drag to reorder by priority. The first language is the most preferred."
      >
        {langSuccess && (
          <Alert className="mb-3 text-success-text">
            <AlertDescription>Language preferences saved.</AlertDescription>
          </Alert>
        )}

        {preferredLangs.length === 0 ? (
          <p className="text-sm text-text-secondary mb-4">
            No language preferences yet. Add one below.
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
                <SelectValue placeholder="Add language" />
              </SelectTrigger>
              <SelectContent>
                {availableToAdd.map(({ code, label }) => (
                  <SelectItem key={code} value={code}>
                    {label}
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
              Add
            </Button>
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        title="Content rating"
        description="Baseline ratings are always on. Opt in to age-restricted tiers to see them in search and listings."
      >
        <ContentRatingPreferences />
      </SettingsSection>

      <SettingsSection
        title="Realm Tag Preferences"
        description="Configure how tags are displayed per realm."
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
                    Max display: {pref.maxDisplay} | Realms:{" "}
                    {pref.realmIds.join(", ")}
                  </span>
                </div>
              ),
            )}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">
            No realm tag preferences configured.
          </p>
        )}
      </SettingsSection>
    </div>
  );
};
