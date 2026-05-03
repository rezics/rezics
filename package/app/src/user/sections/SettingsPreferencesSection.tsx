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
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useUpdateSettingsMutation } from "@rezics/api/user/user.mutations";
import { userQueries } from "@rezics/api/user/user.queries";
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
    <Box
      ref={setNodeRef}
      style={style}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1,
        py: 0.5,
        borderRadius: 1,
        bgcolor: "action.hover",
      }}
    >
      <IconButton
        size="small"
        sx={{ cursor: "grab", touchAction: "none" }}
        {...attributes}
        {...listeners}
        aria-label="drag handle"
      >
        <GripVerticalIcon size={14} />
      </IconButton>
      <Typography variant="body2" sx={{ flex: 1 }}>
        {LANG_LABELS[code] ?? code}
      </Typography>
      <IconButton
        size="small"
        onClick={() => onRemove(code)}
        disabled={disabled}
        aria-label={`remove ${code}`}
      >
        <XIcon size={14} />
      </IconButton>
    </Box>
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
        <CircularProgress />
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
          <Alert severity="success" className="mb-3">
            Language preferences saved.
          </Alert>
        )}

        {preferredLangs.length === 0 ? (
          <Typography variant="body2" color="text.secondary" mb={2}>
            No language preferences yet. Add one below.
          </Typography>
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
              <Stack spacing={1} mb={2}>
                {preferredLangs.map((code) => (
                  <SortableLangItem
                    key={code}
                    code={code}
                    onRemove={handleRemoveLang}
                    disabled={updateSettings.isPending}
                  />
                ))}
              </Stack>
            </SortableContext>
          </DndContext>
        )}

        {availableToAdd.length > 0 && (
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              select
              size="small"
              variant="outlined"
              label="Add language"
              value={addPick}
              onChange={(e) => setAddPick(e.target.value)}
              sx={{ minWidth: 220 }}
            >
              {availableToAdd.map(({ code, label }) => (
                <MenuItem key={code} value={code}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="outlined"
              size="small"
              onClick={() => handleAddLang(addPick)}
              disabled={!addPick || updateSettings.isPending}
            >
              Add
            </Button>
          </Stack>
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
                  <Typography variant="body2" className="font-medium">
                    {realm}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Max display: {pref.maxDisplay} | Realms:{" "}
                    {pref.realmIds.join(", ")}
                  </Typography>
                </div>
              ),
            )}
          </div>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No realm tag preferences configured.
          </Typography>
        )}
      </SettingsSection>
    </div>
  );
};
