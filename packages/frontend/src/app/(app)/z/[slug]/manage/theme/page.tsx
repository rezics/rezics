"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClientOnly } from "@/components/ClientOnly";
import { SectionBoundary } from "@/components/SectionBoundary";
import { useT } from "@/lib/i18n/locale";
import { useState } from "react";

/**
 * Mobile (<640px):
 * +-----------------------------+
 * | Theme                       |
 * | Customize the look...       |
 * |-----------------------------|
 * | Primary Color               |
 * | [#input                  ]  |
 * | Font Family                 |
 * | (o) Sans  (o) Serif  (o) M |
 * |              [Save Changes] |
 * +-----------------------------+
 * w-full，表单单列。
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | Theme                                |
 * | Customize the look and feel...       |
 * | Primary Color  [#input           ]   |
 * | Font Family                          |
 * | (o) Sans  (o) Serif  (o) Mono       |
 * |                      [Save Changes]  |
 * +--------------------------------------+
 * max-w-xl 居中。
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | [manage nav] | Theme                     |
 * |              | Customize the look...     |
 * |              | Primary Color [#input  ]  |
 * |              | Font Family               |
 * |              | (o) Sans (o) Serif (o) M  |
 * |              |         [Save Changes]    |
 * +------------------------------------------+
 * 侧边导航 + 配置区 flex-1，max-w-xl。
 *
 * Ultra-wide (>=1536px): 与 Desktop 一致。
 *
 * Zone 主题设置：主色调 + 字体族选择。
 * 当前为占位实现，状态变更待 API 接入后持久化。
 */

const FONT_OPTIONS = ["sans", "serif", "mono"] as const;
type FontOption = (typeof FONT_OPTIONS)[number];

function ManageZoneThemeContent() {
  const [t] = useT();
  const [primaryColor, setPrimaryColor] = useState("#6366f1");
  const [fontFamily, setFontFamily] = useState<FontOption>("sans");

  const fontLabels: Record<FontOption, string> = {
    sans: t.zone.fontFamilySans,
    serif: t.zone.fontFamilySerif,
    mono: t.zone.fontFamilyMono,
  };

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.zone.manageTheme}</h1>
        <p className="text-muted-foreground text-sm">{t.zone.manageThemeDescription}</p>
      </div>

      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="zone-color">
            {t.zone.primaryColor}
          </label>
          <Input
            id="zone-color"
            onChange={(e) => setPrimaryColor(e.target.value)}
            placeholder="#6366f1"
            value={primaryColor}
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t.zone.fontFamily}</legend>
          <div className="flex flex-wrap gap-4">
            {FONT_OPTIONS.map((opt) => (
              <label className="flex items-center gap-1.5 text-sm" key={opt}>
                <input
                  checked={fontFamily === opt}
                  className="accent-primary"
                  name="font-family"
                  onChange={() => setFontFamily(opt)}
                  type="radio"
                  value={opt}
                />
                {fontLabels[opt]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex justify-end">
          <Button type="submit">{t.zone.saveChanges}</Button>
        </div>
      </form>
    </div>
  );
}

export default function ManageZoneThemePage() {
  return (
    <SectionBoundary>
      <ClientOnly>
        <ManageZoneThemeContent />
      </ClientOnly>
    </SectionBoundary>
  );
}
