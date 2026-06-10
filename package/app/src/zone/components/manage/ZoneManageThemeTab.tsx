import type { ZoneTheme } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import {
  Card,
  CardContent,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
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

function prune<T extends Record<string, unknown>>(value: T): T | undefined {
  const entries = Object.entries(value).filter(
    ([, entry]) => entry !== undefined && entry !== "",
  );
  return entries.length > 0 ? (Object.fromEntries(entries) as T) : undefined;
}

/**
 * Theme tab. Token values are raw CSS color strings authored by the zone
 * manager (rendered via the zone-scoped `--zone-color-*` variables, never
 * app design tokens), so plain text inputs with a live swatch are the
 * honest editor. Image fields are HTTPS URLs; CSP and media-library product
 * decisions stay outside zone schema validation.
 * 主题标签页。token 值是专区管理者撰写的原始 CSS 颜色字符串（经专区
 * 作用域的 `--zone-color-*` 变量渲染，绝非应用设计 token），因此带实时
 * 色样的纯文本输入是最诚实的编辑器。图片字段是 HTTPS URL；CSP 与媒体
 * 库产品决策不属于 zone schema 校验。
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

  return (
    <div className="flex flex-col gap-4">
      <Card surface="contained">
        <CardContent className="flex flex-col gap-4 p-4">
          <ManageGroupHeading>
            {t("zone:manage_theme_tokens")}
          </ManageGroupHeading>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {TOKEN_FIELDS.map((field) => (
              <ManageField key={field} label={t(TOKEN_LABEL_KEYS[field])}>
                <div className="flex items-center gap-2">
                  <Input
                    value={tokens[field] ?? ""}
                    className="font-mono text-sm"
                    onChange={(event) =>
                      setTokens({
                        [field]: event.target.value || undefined,
                      })
                    }
                  />
                  {/* Live swatch of the authored CSS color value. */}
                  {/* 所填 CSS 颜色值的实时色样。 */}
                  <span
                    aria-hidden
                    className="size-6 shrink-0 rounded-sm border border-border-defined"
                    style={{ backgroundColor: tokens[field] ?? "transparent" }}
                  />
                </div>
              </ManageField>
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
                <Input
                  value={images[field] ?? ""}
                  placeholder="https://"
                  className="font-mono text-sm"
                  onChange={(event) =>
                    setImages({ [field]: event.target.value || undefined })
                  }
                />
              </ManageField>
            ))}
            <ManageField label={t("zone:manage_image_header_logo")}>
              <Input
                value={draft.header.logoImageUrl ?? ""}
                placeholder="https://"
                className="font-mono text-sm"
                onChange={(event) => {
                  const header = { ...draft.header };
                  if (event.target.value) {
                    header.logoImageUrl = event.target.value;
                  } else {
                    delete header.logoImageUrl;
                  }
                  onDraftChange({ ...draft, header });
                }}
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
              <Select
                value={layout.contentWidth ?? NONE}
                onValueChange={(value) =>
                  setLayout({
                    contentWidth:
                      value === NONE
                        ? undefined
                        : (value as ThemeLayout["contentWidth"]),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("common:none")}</SelectItem>
                  <SelectItem value="normal">
                    {t("zone:manage_width_normal")}
                  </SelectItem>
                  <SelectItem value="wide">
                    {t("zone:manage_width_wide")}
                  </SelectItem>
                </SelectContent>
              </Select>
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
