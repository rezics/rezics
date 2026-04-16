import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  TextField,
  Typography,
} from '@mui/material';
import { userQueries } from '@rezics/api/user/user.queries';
import { useUpdateSettingsMutation } from '@rezics/api/user/user.mutations';
import { userKeywordQueries } from '@rezics/api/shelf/shelf.queries';
import { useUpdateKeywordsMutation } from '@rezics/api/shelf/shelf.mutations';
import { useQuery } from '@tanstack/react-query';
import { type FC, useState } from 'react';
import { SettingsSection } from '@/user/component/SettingsSection';
import { useRequireAuth } from '@/user/page/useAuth';

const SUPPORTED_LANGUAGES = [
  { code: 'zh-hant', label: 'Traditional Chinese' },
  { code: 'zh-hans', label: 'Simplified Chinese' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: 'Japanese' },
  { code: 'de', label: 'German' },
] as const;

const MAX_KEYWORDS = 500;

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

  const preferredLangs = new Set(settings?.preferredLanguages ?? []);

  const handleToggleLang = (code: string) => {
    const next = new Set(preferredLangs);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    updateSettings.mutate(
      { preferredLanguages: [...next] },
      {
        onSuccess: () => {
          setLangSuccess(true);
          setTimeout(() => setLangSuccess(false), 2000);
        },
      },
    );
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
        description="Select your preferred content languages."
      >
        {langSuccess && (
          <Alert severity="success" className="mb-3">
            Language preferences saved.
          </Alert>
        )}
        <div className="flex flex-wrap gap-2">
          {SUPPORTED_LANGUAGES.map(({ code, label }) => (
            <Chip
              key={code}
              label={label}
              variant={preferredLangs.has(code) ? 'filled' : 'outlined'}
              color={preferredLangs.has(code) ? 'primary' : 'default'}
              onClick={() => handleToggleLang(code)}
              disabled={updateSettings.isPending}
            />
          ))}
        </div>
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
