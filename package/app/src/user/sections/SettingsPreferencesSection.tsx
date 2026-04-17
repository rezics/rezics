import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { userQueries } from '@rezics/api/user/user.queries';
import { useUpdateSettingsMutation } from '@rezics/api/user/user.mutations';
import { userKeywordQueries } from '@rezics/api/shelf/shelf.queries';
import { useUpdateKeywordsMutation } from '@rezics/api/shelf/shelf.mutations';
import { useQuery } from '@tanstack/react-query';
import { GripVerticalIcon, XIcon } from 'lucide-react';
import { type FC, useState } from 'react';
import { SettingsSection } from '@/user/components/SettingsSection';
import { useRequireAuth } from '@/user/pages/useAuth';

const SUPPORTED_LANGUAGES = [
  { code: 'zh-hant', label: 'Traditional Chinese' },
  { code: 'zh-hans', label: 'Simplified Chinese' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: 'Japanese' },
  { code: 'de', label: 'German' },
] as const;

const LANG_LABELS: Record<string, string> = Object.fromEntries(
  SUPPORTED_LANGUAGES.map((l) => [l.code, l.label]),
);

const MAX_KEYWORDS = 500;

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
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1,
        py: 0.5,
        borderRadius: 1,
        bgcolor: 'action.hover',
      }}
    >
      <IconButton
        size="small"
        sx={{ cursor: 'grab', touchAction: 'none' }}
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
  const { data: keywords = [], isLoading: keywordsLoading } = useQuery(
    userKeywordQueries.mine(),
  );

  const updateSettings = useUpdateSettingsMutation();
  const updateKeywords = useUpdateKeywordsMutation();

  const [langSuccess, setLangSuccess] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');

  const preferredLangs: string[] = settings?.preferredLanguages ?? [];
  const availableToAdd = SUPPORTED_LANGUAGES.filter(
    (l) => !preferredLangs.includes(l.code),
  );
  const [addPick, setAddPick] = useState<string>('');

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
    setAddPick('');
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

  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newKeyword.trim();
    if (!trimmed || keywords.length >= MAX_KEYWORDS) return;
    updateKeywords.mutate({ add: [trimmed] });
    setNewKeyword('');
  };

  const handleRemoveKeyword = (keyword: string) => {
    updateKeywords.mutate({ remove: [keyword] });
  };

  if (settingsLoading) {
    return (
      <div className="flex justify-center py-12">
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
        title="Realm Tag Preferences"
        description="Configure how tags are displayed per realm."
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
                    Max display: {pref.maxDisplay} | Realms:{' '}
                    {pref.realmIds.join(', ')}
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

      <SettingsSection
        title="Keyword Vocabulary"
        description="Manage keywords used for content discovery."
        divider={false}
      >
        <Typography variant="caption" color="text.secondary" className="mb-3 block">
          {keywords.length} / {MAX_KEYWORDS} keywords
        </Typography>

        <form onSubmit={handleAddKeyword} className="flex items-end gap-2 mb-4">
          <TextField
            label="Add keyword"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            variant="standard"
            size="small"
            disabled={keywords.length >= MAX_KEYWORDS}
            className="flex-1"
          />
          <Button
            type="submit"
            size="small"
            variant="outlined"
            disabled={
              !newKeyword.trim() ||
              keywords.length >= MAX_KEYWORDS ||
              updateKeywords.isPending
            }
          >
            Add
          </Button>
        </form>

        {keywordsLoading ? (
          <CircularProgress size={20} />
        ) : keywords.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {keywords.map((kw) => (
              <Chip
                key={kw}
                label={kw}
                size="small"
                onDelete={() => handleRemoveKeyword(kw)}
              />
            ))}
          </div>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No keywords added yet.
          </Typography>
        )}
      </SettingsSection>
    </div>
  );
};
