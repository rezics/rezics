"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { useT } from "@/lib/i18n/locale";
import { createListCollection } from "@ark-ui/react/select";
import { type FormEvent, useMemo, useState } from "react";

/**
 * Mobile (<640px):
 * +-------------------------------+
 * | Preferences                   |
 * | Customize your experience...  |
 * |-------------------------------|
 * | [Card: Preferences]           |
 * | Language  [select           ] |
 * | Theme     [select           ] |
 * | Rating    [select           ] |
 * |              [Save          ] |
 * +-------------------------------+
 * Select 控件 full-width 堆叠。
 *
 * Tablet (640-1023px):
 * 与 Mobile 一致。
 *
 * Desktop (1024-1535px):
 * 受 settings layout flex-1 约束，
 * 卡片 w-full。
 *
 * Ultra-wide (>=1536px):
 * 与 Desktop 一致。
 */
export default function SettingsPreferencesPage() {
  const [t] = useT();
  const [language, setLanguage] = useState(["en"]);
  const [theme, setTheme] = useState(["system"]);
  const [contentRating, setContentRating] = useState(["general"]);
  const [saving, setSaving] = useState(false);

  const languageCollection = useMemo(
    () =>
      createListCollection({
        items: [
          { label: "English", value: "en" },
          { label: "简体中文", value: "zh-hans" },
        ],
      }),
    [],
  );

  const themeCollection = useMemo(
    () =>
      createListCollection({
        items: [
          { label: t.settings.themeLight, value: "light" },
          { label: t.settings.themeDark, value: "dark" },
          { label: t.settings.themeSystem, value: "system" },
        ],
      }),
    [t],
  );

  const ratingCollection = useMemo(
    () =>
      createListCollection({
        items: [
          { label: t.settings.contentRatingGeneral, value: "general" },
          { label: t.settings.contentRatingTeen, value: "teen" },
          { label: t.settings.contentRatingMature, value: "mature" },
        ],
      }),
    [t],
  );

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // Preferences persistence via API in a future iteration
      // 偏好持久化将在后续迭代中通过 API 实现
      toast.success({ title: t.settings.saved });
    } catch {
      toast.error({ title: t.common.error });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t.settings.preferences}</h2>
        <p className="text-muted-foreground text-sm">
          {t.settings.preferencesDescription}
        </p>
      </div>

      <Card>
        <form className="flex min-h-0 flex-col" onSubmit={handleSave}>
          <CardHeader title={t.settings.preferences} />
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t.settings.language}
              </label>
              <Select
                collection={languageCollection}
                onValueChange={(detail) => setLanguage(detail.value)}
                value={language}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t.settings.language} />
                </SelectTrigger>
                <SelectContent>
                  {languageCollection.items.map((item) => (
                    <SelectItem item={item} key={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t.settings.theme}
              </label>
              <Select
                collection={themeCollection}
                onValueChange={(detail) => setTheme(detail.value)}
                value={theme}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t.settings.theme} />
                </SelectTrigger>
                <SelectContent>
                  {themeCollection.items.map((item) => (
                    <SelectItem item={item} key={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t.settings.contentRating}
              </label>
              <p className="text-muted-foreground text-xs">
                {t.settings.contentRatingDescription}
              </p>
              <Select
                collection={ratingCollection}
                onValueChange={(detail) => setContentRating(detail.value)}
                value={contentRating}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t.settings.contentRating} />
                </SelectTrigger>
                <SelectContent>
                  {ratingCollection.items.map((item) => (
                    <SelectItem item={item} key={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter>
            <Button isLoading={saving} type="submit">
              {t.common.save}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
