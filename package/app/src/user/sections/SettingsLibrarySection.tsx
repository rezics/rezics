import { useUpdateSettingsMutation } from "@rezics/api/user/user.mutations";
import { userQueries } from "@rezics/api/user/user.queries";
import {
  type BookshelfViewConfig,
  DEFAULT_BOOKSHELF_CONFIG,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { type FC, useEffect, useState } from "react";
import { SettingsSection } from "@/user/components/SettingsSection";
import { useRequireAuth } from "@/user/pages/useAuth";

const COLUMN_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

/** Human label for a breakpoint, derived from its `minWidthPx`. */
function breakpointLabelKey(minWidthPx: number): string {
  if (minWidthPx >= 1280) return "settings:library_bp_wide";
  if (minWidthPx >= 1024) return "settings:library_bp_large";
  if (minWidthPx >= 768) return "settings:library_bp_medium";
  if (minWidthPx >= 640) return "settings:library_bp_small";
  return "settings:library_bp_mobile";
}

export const SettingsLibrarySection: FC = () => {
  const { t } = useTranslation(["common", "settings"]);
  useRequireAuth();

  const { data: settings, isLoading } = useQuery(userQueries.settings());
  const updateSettings = useUpdateSettingsMutation();

  const [config, setConfig] = useState<BookshelfViewConfig>(
    DEFAULT_BOOKSHELF_CONFIG,
  );
  const [saved, setSaved] = useState(false);

  // Hydrate local edit state once settings load (or fall back to default).
  useEffect(() => {
    if (settings) {
      setConfig(settings.library?.bookshelf ?? DEFAULT_BOOKSHELF_CONFIG);
    }
  }, [settings]);

  const persist = (next: BookshelfViewConfig) => {
    setConfig(next);
    updateSettings.mutate(
      { library: { bookshelf: next } },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
      },
    );
  };

  const setColumns = (index: number, columns: number) => {
    persist({
      ...config,
      breakpoints: config.breakpoints.map((bp, i) =>
        i === index ? { ...bp, columns } : bp,
      ),
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <SettingsSection
        title={t("settings:library_title")}
        description={t("settings:library_description")}
      >
        {saved && (
          <Alert className="mb-3 text-success-text">
            <AlertDescription>{t("settings:library_saved")}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          {config.breakpoints.map((bp, index) => (
            <div
              key={bp.minWidthPx}
              className="flex items-center justify-between gap-4"
            >
              <Label className="text-sm">
                {t(breakpointLabelKey(bp.minWidthPx))}
              </Label>
              <Select
                value={String(bp.columns)}
                onValueChange={(value) => setColumns(index, Number(value))}
                disabled={updateSettings.isPending}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLUMN_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} {t("settings:library_columns")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={config.showTitle}
              onCheckedChange={(checked) =>
                persist({ ...config, showTitle: checked === true })
              }
              disabled={updateSettings.isPending}
            />
            {t("settings:library_show_title")}
          </label>

          <Button
            variant="outline"
            size="sm"
            onClick={() => persist(DEFAULT_BOOKSHELF_CONFIG)}
            disabled={updateSettings.isPending}
          >
            {t("settings:library_reset")}
          </Button>
        </div>
      </SettingsSection>
    </div>
  );
};
