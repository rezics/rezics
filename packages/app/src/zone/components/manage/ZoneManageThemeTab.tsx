import type { ZoneTheme } from "@rezics/contract";
import { uploadApi } from "@rezics/contract/api/upload/upload.api";
import { useTranslation } from "@rezics/i18n/react";
import { ColorField, type ColorThemeSet } from "@rezics/ui";
import { createRezicsUploadProvider } from "@rezics/ui/editor";
import {
  Button,
  Card,
  CardContent,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import { ImagePlus } from "lucide-react";
import type React from "react";
import { useMemo } from "react";
import type { ZoneManageDraft } from "../../models/zoneManageDraft";
import { ManageField, ManageGroupHeading } from "./ZoneManageFields";

type ThemeTokens = NonNullable<ZoneTheme["tokens"]>;
type ThemeImages = NonNullable<ZoneTheme["images"]>;
type ThemeLayout = NonNullable<ZoneTheme["layout"]>;

const TOKEN_FIELDS = [
  "background",
  "surface",
  "text",
  "mutedText",
  "accent",
  "accentText",
] as const satisfies readonly (keyof ThemeTokens)[];

const TOKEN_LABEL_KEYS = {
  background: "zone:manage_token_background",
  surface: "zone:manage_token_surface",
  text: "zone:manage_token_text",
  mutedText: "zone:manage_token_mutedText",
  accent: "zone:manage_token_accent",
  accentText: "zone:manage_token_accentText",
} as const satisfies Record<keyof ThemeTokens, `zone:${string}`>;

const IMAGE_FIELDS = [
  "logoUrl",
  "bannerUrl",
  "backgroundUrl",
] as const satisfies readonly (keyof ThemeImages)[];

const IMAGE_LABEL_KEYS = {
  logoUrl: "zone:manage_image_logo",
  bannerUrl: "zone:manage_image_banner",
  backgroundUrl: "zone:manage_image_background",
} as const satisfies Record<keyof ThemeImages, `zone:${string}`>;

const NONE = "__none__";

const COLOR_SWATCHES = [
  { labelKey: "zone:manage_color_brand", value: "#db515c" },
  { labelKey: "zone:manage_color_ink", value: "#1f2937" },
  { labelKey: "zone:manage_color_muted", value: "#64748b" },
  { labelKey: "zone:manage_color_canvas", value: "#ffffff" },
  { labelKey: "zone:manage_color_night", value: "#111827" },
  { labelKey: "zone:manage_color_ocean", value: "#2563eb" },
  { labelKey: "zone:manage_color_forest", value: "#16a34a" },
  { labelKey: "zone:manage_color_amber", value: "#d97706" },
] as const satisfies readonly {
  labelKey: `zone:${string}`;
  value: string;
}[];

const THEME_SETS = [
  {
    labelKey: "zone:manage_theme_set_archive",
    values: {
      background: "#ffffff",
      surface: "#f8fafc",
      text: "#1f2937",
      mutedText: "#64748b",
      accent: "#db515c",
      accentText: "#ffffff",
    },
  },
  {
    labelKey: "zone:manage_theme_set_night",
    values: {
      background: "#111827",
      surface: "#1f2937",
      text: "#f9fafb",
      mutedText: "#cbd5e1",
      accent: "#60a5fa",
      accentText: "#0f172a",
    },
  },
] as const satisfies readonly (Omit<
  ColorThemeSet<keyof ThemeTokens>,
  "label"
> & {
  labelKey: `zone:${string}`;
})[];

function prune<T extends Record<string, unknown>>(value: T): T | undefined {
  const entries = Object.entries(value).filter(
    ([, entry]) => entry !== undefined && entry !== "",
  );
  return entries.length > 0 ? (Object.fromEntries(entries) as T) : undefined;
}

/**
 * Theme tab. Token values are raw CSS color strings authored by the zone
 * manager (rendered via the zone-scoped `--zone-color-*` variables, never app
 * design tokens), so the picker is only an affordance layered over a raw CSS
 * text input. Non-hex values such as `rgb()` and `oklch()` remain first-class.
 * Image upload reuses the markdown editor upload provider and writes the
 * returned URL back into the same manual URL fields; zone does not create IMAGE
 * units here.
 * 主题标签页。token 值是专区管理者撰写的原始 CSS 颜色字符串（经专区
 * 作用域的 `--zone-color-*` 变量渲染，绝非应用设计 token），因此拾色器
 * 只是原始 CSS 文本输入之上的辅助能力。`rgb()` 与 `oklch()` 等非 hex 值
 * 仍是一等输入。图片上传复用 markdown 编辑器的上传 provider，并把返回的
 * URL 写回同一手动 URL 字段；zone 这里不创建 IMAGE 单元。
 */
export function ZoneManageThemeTab({
  draft,
  onDraftChange,
}: {
  draft: ZoneManageDraft;
  onDraftChange: (draft: ZoneManageDraft) => void;
}) {
  const { t } = useTranslation(["zone", "common"]);
  const tokens = draft.theme.tokens ?? {};
  const images = draft.theme.images ?? {};
  const layout = draft.theme.layout ?? {};
  const imageProvider = useMemo(
    () => createRezicsUploadProvider(uploadApi.uploadImage),
    [],
  );

  const setTokens = (patch: Partial<ThemeTokens>) => {
    onDraftChange({
      ...draft,
      theme: { ...draft.theme, tokens: prune({ ...tokens, ...patch }) },
    });
  };

  const setImages = (patch: Partial<ThemeImages>) => {
    onDraftChange({
      ...draft,
      theme: { ...draft.theme, images: prune({ ...images, ...patch }) },
    });
  };

  const setLayout = (patch: Partial<ThemeLayout>) => {
    onDraftChange({
      ...draft,
      theme: { ...draft.theme, layout: prune({ ...layout, ...patch }) },
    });
  };
  const colorSwatches = useMemo(
    () =>
      COLOR_SWATCHES.map((swatch) => ({
        label: t(swatch.labelKey),
        value: swatch.value,
      })),
    [t],
  );
  const themeSets = useMemo(
    () =>
      THEME_SETS.map((set) => ({
        label: t(set.labelKey),
        values: set.values,
      })),
    [t],
  );

  return (
    <div className="flex flex-col gap-4">
      <Card surface="contained">
        <CardContent className="flex flex-col gap-4 p-4">
          <ManageGroupHeading>
            {t("zone:manage_theme_tokens")}
          </ManageGroupHeading>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {TOKEN_FIELDS.map((field) => (
              <ColorField<keyof ThemeTokens>
                key={field}
                label={t(TOKEN_LABEL_KEYS[field])}
                value={tokens[field] ?? ""}
                placeholder="oklch(...)"
                swatches={colorSwatches}
                themeSets={themeSets}
                onApplyThemeSet={setTokens}
                onChange={(value) => setTokens({ [field]: value || undefined })}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card surface="contained">
        <CardContent className="flex flex-col gap-4 p-4">
          <ManageGroupHeading>
            {t("zone:manage_theme_images")}
          </ManageGroupHeading>
          <div className="grid gap-4 md:grid-cols-2">
            {IMAGE_FIELDS.map((field) => (
              <ManageField key={field} label={t(IMAGE_LABEL_KEYS[field])}>
                <ImageUrlInput
                  value={images[field] ?? ""}
                  uploadLabel={t("common:upload_image")}
                  onChange={(value) =>
                    setImages({ [field]: value || undefined })
                  }
                  onUpload={(url) => setImages({ [field]: url })}
                  uploadPanel={imageProvider.render}
                />
              </ManageField>
            ))}
            <ManageField label={t("zone:manage_image_header_logo")}>
              <ImageUrlInput
                value={draft.header.logoImageUrl ?? ""}
                uploadLabel={t("common:upload_image")}
                onChange={(value) => {
                  const header = { ...draft.header };
                  if (value) header.logoImageUrl = value;
                  else delete header.logoImageUrl;
                  onDraftChange({ ...draft, header });
                }}
                onUpload={(url) => {
                  onDraftChange({
                    ...draft,
                    header: { ...draft.header, logoImageUrl: url },
                  });
                }}
                uploadPanel={imageProvider.render}
              />
            </ManageField>
          </div>
        </CardContent>
      </Card>

      <Card surface="contained">
        <CardContent className="flex flex-col gap-4 p-4">
          <ManageGroupHeading>
            {t("zone:manage_theme_layout")}
          </ManageGroupHeading>
          <div className="grid gap-4 md:grid-cols-2">
            <ManageField label={t("zone:manage_content_width")}>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="1440"
                value={layout.contentMaxWidth ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setLayout({
                    contentMaxWidth: value === "" ? undefined : Number(value),
                  });
                }}
              />
            </ManageField>
            <ManageField label={t("zone:manage_density")}>
              <Select
                value={layout.density ?? NONE}
                onValueChange={(value) =>
                  setLayout({
                    density:
                      value === NONE
                        ? undefined
                        : (value as ThemeLayout["density"]),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("common:none")}</SelectItem>
                  <SelectItem value="compact">
                    {t("zone:manage_density_compact")}
                  </SelectItem>
                  <SelectItem value="comfortable">
                    {t("zone:manage_density_comfortable")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </ManageField>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ImageUrlInput({
  value,
  uploadLabel,
  onChange,
  onUpload,
  uploadPanel,
}: {
  value: string;
  uploadLabel: string;
  onChange: (value: string) => void;
  onUpload: (url: string) => void;
  uploadPanel: (props: { onInsert: (url: string) => void }) => React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 gap-2">
      <Input
        value={value}
        placeholder="https://"
        className="font-mono text-sm"
        onChange={(event) => onChange(event.target.value)}
      />
      <Popover>
        <PopoverTrigger
          render={
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label={uploadLabel}
            />
          }
        >
          <ImagePlus className="size-4" aria-hidden />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-96 rounded-md">
          {uploadPanel({ onInsert: onUpload })}
        </PopoverContent>
      </Popover>
    </div>
  );
}
