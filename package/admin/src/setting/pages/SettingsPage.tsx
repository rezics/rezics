import {
  DEFAULT_LANGUAGE,
  LANGUAGE_META,
  LANGUAGES,
  normalizeLanguage,
} from "@rezics/contract";
import { setLocale, useLocale, useTranslation } from "@rezics/i18n/react";
import {
  Card,
  CardContent,
  Checkbox,
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import React from "react";
import { Page } from "@/core/layouts/Page";

const LANGUAGE_OPTIONS = Object.values(LANGUAGES);

export default function SettingsPage() {
  const { t } = useTranslation(["admin"]);
  const [dark, setDark] = React.useState(false);
  const locale = normalizeLanguage(useLocale()) ?? DEFAULT_LANGUAGE;

  const handleLanguageChange = (value: string | null) => {
    const nextLocale = value ? normalizeLanguage(value) : null;
    if (nextLocale) setLocale(nextLocale);
  };

  return (
    <Page
      title={t("admin:setting_title")}
      description={t("admin:setting_description")}
    >
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12">
          <Card>
            <CardContent>
              <h3 className="text-sm font-bold mb-2">
                {t("admin:setting_appearance_title")}
              </h3>
              <Label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={dark}
                  onCheckedChange={(v) => setDark(v === true)}
                />
                <span>{t("admin:setting_dark_mode_label")}</span>
              </Label>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-12">
          <Card>
            <CardContent>
              <h3 className="text-sm font-bold mb-2">
                {t("admin:setting_language_title")}
              </h3>
              <p className="mb-4 text-sm leading-normal text-text-secondary">
                {t("admin:setting_language_description")}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Label htmlFor="admin-language">
                  {t("admin:setting_language_select_label")}
                </Label>
                <Select value={locale} onValueChange={handleLanguageChange}>
                  <SelectTrigger id="admin-language" className="min-w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {LANGUAGE_OPTIONS.map((language) => (
                        <SelectItem key={language} value={language}>
                          {LANGUAGE_META[language].nativeName}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Page>
  );
}
