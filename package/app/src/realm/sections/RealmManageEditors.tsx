import {
  useClearRealmExtraValueMutation,
  useSetRealmExtraValueMutation,
} from "@rezics/api/realm/realm-extra.mutations";
import { tagApi } from "@rezics/api/tag/tag";
import { unitApi, unitQueries } from "@rezics/api/unit/unit";
import { unitDetailQuery } from "@rezics/api/unit/unit.queries";
import { useUpdateZone, zoneByUnitIdQueryOptions } from "@rezics/api/zone/zone";
import type {
  RealmAvatarExtra,
  RealmBannerExtra,
  RealmTagView,
  RealmTagViewStyle,
  TagTreeNode,
  UnitDTO,
  WikiZoneConfig,
  WikiZoneHomepageSection,
  WikiZoneNavigation,
  WikiZoneTheme,
} from "@rezics/contract";
import {
  contentDocMarkdownFallback,
  DEFAULT_LANGUAGE,
  defaultSupportLanguage,
  markdownContentDoc,
  normalizeLanguage,
} from "@rezics/contract";
import { getI18nRuntime } from "@rezics/i18n/runtime";
import { TranslationEditor, type TranslationEditorEntry } from "@rezics/ui";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@rezics/ui/shadcn";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ListTree,
  Plus,
  Save,
  Tag,
  Trash2,
  Type,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MoveHandler, NodeRendererProps, TreeApi } from "react-arborist";
import { Tree } from "react-arborist";
import { toast } from "sonner";
import { useAuthoringLanguageDefault } from "@/shared/hooks/useAuthoringLanguageDefault";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { getTranslation } from "@/shared/utils/translation-helpers";
import {
  clearTreeEditOpLog,
  ensureTreeChildren,
  emptyTreeEditOpLog,
  enqueueTreeEditOp,
  TreeEditorFooter,
  TreeEditorRow,
  TreeMoveToDialog,
  type TreeActionItem,
  type TreeEditOpLog,
} from "@/tree-edit";

function nodeLabel(node: TagTreeNode) {
  const translations = node.labelTranslations?.translations;
  const fallbackLanguage = node.labelTranslations?.fallbackLanguage;
  const language = getI18nRuntime().i18n.language;
  const translated =
    translations?.[language] ??
    (fallbackLanguage ? translations?.[fallbackLanguage] : undefined);
  return (
    translated?.trim() ||
    node.label?.trim() ||
    node.labelUnitId?.slice(0, 8) ||
    node.tagId?.slice(0, 8) ||
    getI18nRuntime().i18n.t("common:untitled")
  );
}

function unitLabel(unit: UnitDTO) {
  const tr = getTranslation(
    unit.translations,
    undefined,
    defaultSupportLanguage(unit.supportLanguages) ??
      unit.resolvedLanguage ??
      undefined,
  );
  return unit.title ?? tr?.title ?? unit.slug ?? unit.id;
}

const wikiTemplateOptions = [
  "wiki-classic",
  "wiki-media",
  "wiki-database",
  "wiki-minimal",
] as const;
type WikiTemplateOption = (typeof wikiTemplateOptions)[number];

const wikiHomepageTemplateOptions = [
  "wiki-classic-home",
  "wiki-media-home",
  "wiki-database-home",
  "wiki-minimal-home",
] as const;
type WikiHomepageTemplateOption = (typeof wikiHomepageTemplateOptions)[number];

const densityOptions = ["comfortable", "compact"] as const;
const navPositionOptions = ["side", "top"] as const;
const contentWidthOptions = ["normal", "wide"] as const;
const infoboxPositionOptions = ["right", "inline"] as const;
const labelInsertTargets = ["navigation", "homepage"] as const;
const TREE_DROP_INDENT = 32;
type DensityOption = (typeof densityOptions)[number];
type NavPositionOption = (typeof navPositionOptions)[number];
type ContentWidthOption = (typeof contentWidthOptions)[number];
type InfoboxPositionOption = (typeof infoboxPositionOptions)[number];
type LabelInsertTarget = (typeof labelInsertTargets)[number];

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function parseJsonField<T>(value: string, fallback: T): T {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return JSON.parse(trimmed) as T;
}

function hexToRgb(value: string): [number, number, number] | null {
  const hex = value.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]) {
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function hasLowContrast(foreground: string, background: string) {
  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);
  if (!fg || !bg) return false;
  const fgLum = relativeLuminance(fg);
  const bgLum = relativeLuminance(bg);
  const lighter = Math.max(fgLum, bgLum);
  const darker = Math.min(fgLum, bgLum);
  return (lighter + 0.05) / (darker + 0.05) < 4.5;
}

export function TagViewPreferenceEditor({
  realmId,
  initialValue,
}: {
  realmId: string;
  initialValue?: RealmTagView;
}) {
  const [defaultStyle, setDefaultStyle] = useState<RealmTagViewStyle>(
    initialValue?.defaultStyle ?? "flat",
  );
  const [allowViewerSwitch, setAllowViewerSwitch] = useState(
    initialValue?.allowViewerSwitch ?? true,
  );
  const [error, setError] = useState<string | null>(null);
  const setValue = useSetRealmExtraValueMutation();

  useEffect(() => {
    setDefaultStyle(initialValue?.defaultStyle ?? "flat");
    setAllowViewerSwitch(initialValue?.allowViewerSwitch ?? true);
  }, [initialValue]);

  const save = async () => {
    setError(null);
    try {
      await setValue.mutateAsync({
        realmId,
        key: "tagView",
        value: { defaultStyle, allowViewerSwitch },
      });
      toast.success("Tags tab view saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(message);
      toast.error(message);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-md bg-surface-subtle p-4">
      <div>
        <h3 className="text-sm font-medium leading-ui text-text-primary">
          Tags tab view
        </h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
        <div className="flex flex-col gap-1">
          <Label htmlFor="realm-tag-view-style">Default view</Label>
          <Select
            value={defaultStyle}
            onValueChange={(value) =>
              setDefaultStyle(value as RealmTagViewStyle)
            }
          >
            <SelectTrigger id="realm-tag-view-style">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="flat">Flat</SelectItem>
              <SelectItem value="grouped">Grouped</SelectItem>
              <SelectItem value="tree">Tree</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant={allowViewerSwitch ? "secondary" : "outline"}
          onClick={() => setAllowViewerSwitch((value) => !value)}
        >
          {allowViewerSwitch ? "Viewer switch on" : "Viewer switch off"}
        </Button>
        <Button type="button" onClick={save} disabled={setValue.isPending}>
          {getI18nRuntime().i18n.t("common:save")}
        </Button>
      </div>
      {error ? (
        <p className="text-sm leading-body text-error-text">{error}</p>
      ) : null}
    </div>
  );
}

export function WikiZonePicker({
  realmId,
  value,
}: {
  realmId: string;
  value?: string | null;
}) {
  const [zoneId, setZoneId] = useState(value ?? "");
  const [error, setError] = useState<string | null>(null);
  const trimmedZoneId = zoneId.trim();
  const setValue = useSetRealmExtraValueMutation();
  const clearValue = useClearRealmExtraValueMutation();
  const zoneQuery = useQuery(zoneByUnitIdQueryOptions(trimmedZoneId));

  useEffect(() => {
    setZoneId(value ?? "");
  }, [value]);

  const save = async () => {
    setError(null);
    try {
      if (trimmedZoneId) {
        await setValue.mutateAsync({
          realmId,
          key: "wikiZoneUnitId",
          value: trimmedZoneId,
        });
      } else {
        await clearValue.mutateAsync({ realmId, key: "wikiZoneUnitId" });
      }
      toast.success(getI18nRuntime().i18n.t("entity:realm_wiki_zone_saved"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(message);
      toast.error(message);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-md bg-surface-subtle p-4">
      <div>
        <Label>{getI18nRuntime().i18n.t("entity:realm_wiki_zone")}</Label>
        <p className="mt-1 text-sm leading-body text-text-secondary">
          {getI18nRuntime().i18n.t("entity:realm_wiki_zone_description")}
        </p>
      </div>
      <Input
        value={zoneId}
        onChange={(event) => setZoneId(event.target.value)}
        placeholder={getI18nRuntime().i18n.t(
          "entity:realm_wiki_zone_unit_id_placeholder",
        )}
      />
      {trimmedZoneId && (
        <div className="rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm leading-ui">
          {zoneQuery.data ? (
            <div className="flex flex-col gap-1">
              <span className="font-medium text-text-primary">
                {zoneQuery.data.name || zoneQuery.data.slug}
              </span>
              <span className="text-text-secondary">
                {getI18nRuntime().i18n.t("common:selected_id", {
                  id: trimmedZoneId,
                })}
              </span>
            </div>
          ) : (
            <span className="text-text-secondary">
              {getI18nRuntime().i18n.t("common:selected_id", {
                id: trimmedZoneId,
              })}
            </span>
          )}
        </div>
      )}
      <div className="flex justify-end gap-2">
        {error && (
          <p className="mr-auto text-sm leading-ui text-error-text">{error}</p>
        )}
        <Button type="button" variant="ghost" onClick={() => setZoneId("")}>
          {getI18nRuntime().i18n.t("common:clear")}
        </Button>
        <Button
          type="button"
          onClick={save}
          disabled={setValue.isPending || clearValue.isPending}
        >
          {getI18nRuntime().i18n.t("common:save")}
        </Button>
      </div>
      {zoneQuery.data && (
        <WikiZoneConfigEditor realmId={realmId} zone={zoneQuery.data} />
      )}
    </div>
  );
}

export function WikiZoneConfigEditor({
  realmId,
  zone,
}: {
  realmId: string;
  zone: {
    unitId: string;
    template: string;
    wiki?: WikiZoneConfig | null;
  };
}) {
  const updateZone = useUpdateZone();
  const wiki = zone.wiki;
  const theme = wiki?.theme;
  const homepage = wiki?.homepage;
  const [template, setTemplate] = useState<WikiTemplateOption>(
    theme?.template ?? "wiki-classic",
  );
  const [homepageTemplate, setHomepageTemplate] =
    useState<WikiHomepageTemplateOption>(
      theme?.homepageTemplate ?? homepage?.template ?? "wiki-classic-home",
    );
  const [background, setBackground] = useState(
    theme?.palette?.background ?? "",
  );
  const [surface, setSurface] = useState(theme?.palette?.surface ?? "");
  const [text, setText] = useState(theme?.palette?.text ?? "");
  const [accent, setAccent] = useState(theme?.palette?.accent ?? "");
  const [density, setDensity] = useState<DensityOption>(
    theme?.chrome?.density ?? "comfortable",
  );
  const [navPosition, setNavPosition] = useState<NavPositionOption>(
    theme?.chrome?.navPosition ?? "side",
  );
  const [contentWidth, setContentWidth] = useState<ContentWidthOption>(
    theme?.layout?.contentWidth ?? "normal",
  );
  const [infoboxPosition, setInfoboxPosition] = useState<InfoboxPositionOption>(
    theme?.layout?.infoboxPosition ?? "right",
  );
  const [navigationJson, setNavigationJson] = useState(
    prettyJson(wiki?.navigation ?? { sections: [] }),
  );
  const [sectionsJson, setSectionsJson] = useState(
    prettyJson(homepage?.sections ?? []),
  );
  const [labelSearch, setLabelSearch] = useState("");
  const [labelTitle, setLabelTitle] = useState("");
  const [labelTarget, setLabelTarget] =
    useState<LabelInsertTarget>("navigation");
  const [error, setError] = useState<string | null>(null);
  const authoringLanguage = useAuthoringLanguageDefault();
  const readContext = useReadLanguageContext();
  const labelSearchTerm = labelSearch.trim();
  const { data: labelSearchData } = useQuery({
    ...unitQueries.search(labelSearchTerm, {
      type: "LABEL",
      languages: readContext.languages,
      appLocale: readContext.appLocale,
      languageMode: readContext.languageMode,
      limit: 8,
    }),
    enabled: readContext.ready && Boolean(labelSearchTerm),
  });

  useEffect(() => {
    setTemplate(theme?.template ?? "wiki-classic");
    setHomepageTemplate(
      theme?.homepageTemplate ?? homepage?.template ?? "wiki-classic-home",
    );
    setBackground(theme?.palette?.background ?? "");
    setSurface(theme?.palette?.surface ?? "");
    setText(theme?.palette?.text ?? "");
    setAccent(theme?.palette?.accent ?? "");
    setDensity(theme?.chrome?.density ?? "comfortable");
    setNavPosition(theme?.chrome?.navPosition ?? "side");
    setContentWidth(theme?.layout?.contentWidth ?? "normal");
    setInfoboxPosition(theme?.layout?.infoboxPosition ?? "right");
    setNavigationJson(prettyJson(wiki?.navigation ?? { sections: [] }));
    setSectionsJson(prettyJson(homepage?.sections ?? []));
  }, [homepage, theme, wiki]);

  const insertLabel = (labelUnitId: string, target: LabelInsertTarget) => {
    try {
      if (target === "navigation") {
        const navigation = parseJsonField<WikiZoneNavigation>(navigationJson, {
          sections: [],
        });
        const [firstSection, ...restSections] = navigation.sections;
        const nextFirstSection = firstSection ?? { id: "main", items: [] };
        setNavigationJson(
          prettyJson({
            sections: [
              {
                ...nextFirstSection,
                items: [
                  { kind: "labelHeading", labelUnitId },
                  ...nextFirstSection.items,
                ],
              },
              ...restSections,
            ],
          }),
        );
      } else {
        const sections = parseJsonField<WikiZoneHomepageSection[]>(
          sectionsJson,
          [],
        );
        setSectionsJson(
          prettyJson([
            {
              id: `label-${labelUnitId.slice(0, 8)}`,
              kind: "manualLinks",
              titleLabelUnitId: labelUnitId,
              links: [],
            },
            ...sections,
          ]),
        );
      }
      setError(null);
    } catch {
      const message = getI18nRuntime().i18n.t(
        "entity:realm_wiki_zone_invalid_json",
      );
      setError(message);
      toast.error(message);
    }
  };

  const createLabel = async () => {
    const title = labelTitle.trim();
    if (!title) return;
    setError(null);
    try {
      const created = await unitApi.create({
        type: "LABEL",
        isLanguageNeutral: true,
        translations: [{ language: authoringLanguage, title }],
      });
      insertLabel(created.id, labelTarget);
      setLabelTitle("");
      toast.success(
        getI18nRuntime().i18n.t("entity:realm_wiki_zone_label_created"),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(message);
      toast.error(message);
    }
  };

  const save = async () => {
    setError(null);
    try {
      const navigation = parseJsonField<WikiZoneNavigation>(navigationJson, {
        sections: [],
      });
      const sections = parseJsonField<WikiZoneHomepageSection[]>(
        sectionsJson,
        [],
      );
      const palette: NonNullable<WikiZoneTheme["palette"]> = {};
      if (background.trim()) palette.background = background.trim();
      if (surface.trim()) palette.surface = surface.trim();
      if (text.trim()) palette.text = text.trim();
      if (accent.trim()) palette.accent = accent.trim();
      if (
        palette.text &&
        ((palette.background &&
          hasLowContrast(palette.text, palette.background)) ||
          (palette.surface && hasLowContrast(palette.text, palette.surface)))
      ) {
        throw new Error(
          getI18nRuntime().i18n.t("entity:realm_wiki_zone_low_contrast"),
        );
      }

      const nextTheme: WikiZoneTheme = {
        template,
        homepageTemplate,
        ...(Object.keys(palette).length ? { palette } : {}),
        chrome: { density, navPosition },
        layout: { contentWidth, infoboxPosition },
      };
      const nextWiki: WikiZoneConfig = {
        filters: {
          ...wiki?.filters,
          realmUnitId: wiki?.filters.realmUnitId ?? realmId,
          type: "POST",
          postKind: wiki?.filters.postKind ?? "WIKI",
        },
        navigation,
        homepage: { template: homepageTemplate, sections },
        theme: nextTheme,
      };

      await updateZone.mutateAsync({
        unitId: zone.unitId,
        input: { template, wiki: nextWiki },
      });
      toast.success(
        getI18nRuntime().i18n.t("entity:realm_wiki_zone_config_saved"),
      );
    } catch (error) {
      const message =
        error instanceof SyntaxError
          ? getI18nRuntime().i18n.t("entity:realm_wiki_zone_invalid_json")
          : error instanceof Error
            ? error.message
            : String(error);
      setError(message);
      toast.error(message);
    }
  };

  return (
    <div className="flex flex-col gap-4 border-t border-border-default pt-4">
      <div>
        <h4 className="text-sm font-medium leading-ui text-text-primary">
          {getI18nRuntime().i18n.t("entity:realm_wiki_zone_editor")}
        </h4>
        <p className="mt-1 text-sm leading-body text-text-secondary">
          {getI18nRuntime().i18n.t("entity:realm_wiki_zone_editor_description")}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <LabeledSelect
          label={getI18nRuntime().i18n.t("entity:realm_wiki_zone_template")}
          value={template}
          options={wikiTemplateOptions}
          onChange={setTemplate}
        />
        <LabeledSelect
          label={getI18nRuntime().i18n.t(
            "entity:realm_wiki_zone_homepage_template",
          )}
          value={homepageTemplate}
          options={wikiHomepageTemplateOptions}
          onChange={setHomepageTemplate}
        />
        <LabeledSelect
          label={getI18nRuntime().i18n.t(
            "entity:realm_wiki_zone_theme_density",
          )}
          value={density}
          options={densityOptions}
          onChange={setDensity}
        />
        <LabeledSelect
          label={getI18nRuntime().i18n.t(
            "entity:realm_wiki_zone_theme_nav_position",
          )}
          value={navPosition}
          options={navPositionOptions}
          onChange={setNavPosition}
        />
        <LabeledSelect
          label={getI18nRuntime().i18n.t(
            "entity:realm_wiki_zone_theme_content_width",
          )}
          value={contentWidth}
          options={contentWidthOptions}
          onChange={setContentWidth}
        />
        <LabeledSelect
          label={getI18nRuntime().i18n.t(
            "entity:realm_wiki_zone_theme_infobox_position",
          )}
          value={infoboxPosition}
          options={infoboxPositionOptions}
          onChange={setInfoboxPosition}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <LabeledInput
          label={getI18nRuntime().i18n.t(
            "entity:realm_wiki_zone_theme_background",
          )}
          value={background}
          onChange={setBackground}
        />
        <LabeledInput
          label={getI18nRuntime().i18n.t(
            "entity:realm_wiki_zone_theme_surface",
          )}
          value={surface}
          onChange={setSurface}
        />
        <LabeledInput
          label={getI18nRuntime().i18n.t("entity:realm_wiki_zone_theme_text")}
          value={text}
          onChange={setText}
        />
        <LabeledInput
          label={getI18nRuntime().i18n.t("entity:realm_wiki_zone_theme_accent")}
          value={accent}
          onChange={setAccent}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-border-default bg-surface-base p-3">
        <div>
          <h5 className="text-sm font-medium leading-ui text-text-primary">
            {getI18nRuntime().i18n.t("entity:realm_wiki_zone_label_picker")}
          </h5>
          <p className="mt-1 text-sm leading-body text-text-secondary">
            {getI18nRuntime().i18n.t(
              "entity:realm_wiki_zone_label_picker_description",
            )}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_11rem]">
          <Input
            value={labelSearch}
            onChange={(event) => setLabelSearch(event.target.value)}
            placeholder={getI18nRuntime().i18n.t(
              "entity:realm_wiki_zone_label_search_placeholder",
            )}
          />
          <LabeledSelect
            label=""
            value={labelTarget}
            options={labelInsertTargets}
            onChange={setLabelTarget}
            getLabel={(option) =>
              option === "navigation"
                ? getI18nRuntime().i18n.t(
                    "entity:realm_wiki_zone_label_navigation",
                  )
                : getI18nRuntime().i18n.t(
                    "entity:realm_wiki_zone_label_homepage",
                  )
            }
          />
        </div>
        {labelSearchTerm && labelSearchData?.units?.length ? (
          <div className="flex flex-wrap gap-2">
            {labelSearchData.units.map((unit) => (
              <Button
                key={unit.id}
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => insertLabel(unit.id, labelTarget)}
              >
                {unitLabel(unit)}
              </Button>
            ))}
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <Input
            value={labelTitle}
            onChange={(event) => setLabelTitle(event.target.value)}
            placeholder={getI18nRuntime().i18n.t(
              "entity:realm_wiki_zone_label_title_placeholder",
            )}
          />
          <Button
            type="button"
            variant="outline"
            onClick={createLabel}
            disabled={!labelTitle.trim()}
          >
            {getI18nRuntime().i18n.t("entity:realm_wiki_zone_label_create")}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>
            {getI18nRuntime().i18n.t("entity:realm_wiki_zone_navigation_json")}
          </Label>
          <Textarea
            value={navigationJson}
            onChange={(event) => setNavigationJson(event.target.value)}
            className="min-h-48 font-mono text-xs"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>
            {getI18nRuntime().i18n.t(
              "entity:realm_wiki_zone_homepage_sections_json",
            )}
          </Label>
          <Textarea
            value={sectionsJson}
            onChange={(event) => setSectionsJson(event.target.value)}
            className="min-h-48 font-mono text-xs"
          />
        </div>
      </div>

      <div className="flex justify-end">
        {error && (
          <p className="mr-auto text-sm leading-ui text-error-text">{error}</p>
        )}
        <Button type="button" onClick={save} disabled={updateZone.isPending}>
          {getI18nRuntime().i18n.t("common:save")}
        </Button>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function LabeledSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  getLabel,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  getLabel?: (value: T) => string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {label ? <Label>{label}</Label> : null}
      <Select value={value} onValueChange={(next) => onChange(next as T)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {getLabel ? getLabel(option) : option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function TagTreeEditor({
  realmId,
  initialValue,
}: {
  realmId: string;
  initialValue?: TagTreeNode[];
}) {
  type EditorNode = TagTreeNode & { id: string; children?: EditorNode[] };
  type AddTreeNodeTarget =
    | { kind: "root" }
    | { kind: "siblingAfter"; nodeId: string }
    | { kind: "child"; nodeId: string };

  const nextIdRef = useRef(0);
  const makeEditorId = useCallback(() => {
    nextIdRef.current += 1;
    return `realm-tag-node-${nextIdRef.current}`;
  }, []);
  const toEditorNodes = useCallback(
    (items: TagTreeNode[] | undefined): EditorNode[] => {
      const visit = (current: TagTreeNode[]): EditorNode[] =>
        current.map((item) => ({
          ...item,
          id: makeEditorId(),
          children: item.children?.length ? visit(item.children) : [],
        }));
      return visit(items ?? []);
    },
    [makeEditorId],
  );
  const toTagTreeNodes = useCallback((items: EditorNode[]): TagTreeNode[] => {
    const visit = (current: EditorNode[]): TagTreeNode[] =>
      current.map(({ id: _id, children, ...item }) => ({
        ...item,
        children: children?.length ? visit(children) : undefined,
      }));
    return visit(items);
  }, []);

  const [nodes, setNodes] = useState<EditorNode[]>(() =>
    toEditorNodes(initialValue),
  );
  const [savedNodes, setSavedNodes] = useState<EditorNode[]>(() =>
    toEditorNodes(initialValue),
  );
  const [opLog, setOpLog] = useState<TreeEditOpLog>(emptyTreeEditOpLog);
  const [labelLanguage, setLabelLanguage] = useState(DEFAULT_LANGUAGE);
  const [search, setSearch] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [moveToNodeId, setMoveToNodeId] = useState<string | null>(null);
  const [addTarget, setAddTarget] = useState<AddTreeNodeTarget>({
    kind: "root",
  });
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const treeRef = useRef<TreeApi<EditorNode> | null>(null);
  const treeAreaRef = useRef<HTMLDivElement | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [treeSize, setTreeSize] = useState({ width: 0, height: 360 });
  const setValue = useSetRealmExtraValueMutation();
  const authoringLanguage = useAuthoringLanguageDefault();
  const readContext = useReadLanguageContext();
  const searchTerm = search.trim();
  const { data: labelSearchData, isLoading: labelSearchLoading } = useQuery({
    ...unitQueries.search(searchTerm, {
      type: "LABEL",
      languages: readContext.languages,
      appLocale: readContext.appLocale,
      languageMode: readContext.languageMode,
      limit: 8,
    }),
    enabled: readContext.ready && Boolean(searchTerm),
  });
  const { data: tagSearchData, isLoading: tagSearchLoading } = useQuery({
    ...unitQueries.search(searchTerm, {
      type: "TAG",
      languages: readContext.languages,
      appLocale: readContext.appLocale,
      languageMode: readContext.languageMode,
      limit: 8,
    }),
    enabled: readContext.ready && Boolean(searchTerm),
  });
  const serializedNodes = useMemo(
    () => toTagTreeNodes(nodes),
    [nodes, toTagTreeNodes],
  );

  const existingUnitRefs = useMemo(() => {
    const tagIds = new Set<string>();
    const labelUnitIds = new Set<string>();
    const visit = (items: EditorNode[]) => {
      for (const item of items) {
        if (item.tagId) tagIds.add(item.tagId);
        if (item.labelUnitId) labelUnitIds.add(item.labelUnitId);
        if (item.children?.length) visit(item.children);
      }
    };
    visit(nodes);
    return { tagIds, labelUnitIds };
  }, [nodes]);

  const labelResults = useMemo(
    () =>
      (labelSearchData?.units ?? []).filter(
        (unit) => unit.id && !existingUnitRefs.labelUnitIds.has(unit.id),
      ),
    [existingUnitRefs.labelUnitIds, labelSearchData?.units],
  );
  const tagResults = useMemo(
    () =>
      (tagSearchData?.units ?? []).filter(
        (unit) => unit.id && !existingUnitRefs.tagIds.has(unit.id),
      ),
    [existingUnitRefs.tagIds, tagSearchData?.units],
  );

  useEffect(() => {
    const next = toEditorNodes(initialValue);
    setNodes(next);
    setSavedNodes(next);
    setOpLog(emptyTreeEditOpLog);
  }, [initialValue, toEditorNodes]);

  const enqueueOp = (
    type: string,
    targetId?: string,
    options?: Record<string, unknown>,
  ) => {
    setOpLog((current) =>
      enqueueTreeEditOp(current, { type, targetId, options }),
    );
  };

  const treeAreaCallbackRef = useCallback((el: HTMLDivElement | null) => {
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
    treeAreaRef.current = el;
    if (!el) return;

    const measure = () => {
      const nextSize = {
        width: el.clientWidth,
        height: Math.max(360, el.clientHeight),
      };
      setTreeSize((current) =>
        current.width === nextSize.width && current.height === nextSize.height
          ? current
          : nextSize,
      );
    };
    measure();
    resizeObserverRef.current = new ResizeObserver(measure);
    resizeObserverRef.current.observe(el);
  }, []);

  const updateNodeById = (
    id: string,
    mutate: (node: EditorNode) => EditorNode,
  ) => {
    const visit = (items: EditorNode[]): EditorNode[] =>
      items.map((item) => {
        if (item.id === id) return mutate(item);
        return item.children?.length
          ? { ...item, children: visit(item.children) }
          : item;
      });
    setNodes((current) => visit(current));
  };

  const deleteNodeById = (id: string) => {
    const visit = (items: EditorNode[]): EditorNode[] =>
      items.flatMap((item) => {
        if (item.id === id) return [];
        return [
          item.children?.length
            ? { ...item, children: visit(item.children) }
            : item,
        ];
      });
    setNodes((current) => visit(current));
    enqueueOp("delete", id);
  };

  const insertSiblingAfter = (targetId: string, nextNode: EditorNode) => {
    const visit = (items: EditorNode[]): EditorNode[] => {
      const index = items.findIndex((item) => item.id === targetId);
      if (index >= 0) {
        return [
          ...items.slice(0, index + 1),
          nextNode,
          ...items.slice(index + 1),
        ];
      }
      return items.map((item) =>
        item.children?.length
          ? { ...item, children: visit(item.children) }
          : item,
      );
    };
    setNodes((current) => visit(current));
    enqueueOp("addSiblingAfter", targetId);
  };

  const addChild = (parentId: string, nextNode: EditorNode) => {
    updateNodeById(parentId, (node) => ({
      ...node,
      children: [...(node.children ?? []), nextNode],
    }));
    window.setTimeout(() => treeRef.current?.open(parentId), 0);
    enqueueOp("addChild", parentId);
  };

  const insertAtTarget = (target: AddTreeNodeTarget, nextNode: EditorNode) => {
    if (target.kind === "root") {
      setNodes((current) => [...current, nextNode]);
      enqueueOp("addRoot");
      return;
    }
    if (target.kind === "siblingAfter") {
      insertSiblingAfter(target.nodeId, nextNode);
      return;
    }
    addChild(target.nodeId, nextNode);
  };

  const createTagNode = (tag: {
    tagId: string;
    label?: string;
  }): EditorNode => ({
    id: makeEditorId(),
    tagId: tag.tagId,
    label: tag.label,
  });

  const createPublicLabelNode = (labelUnitId: string, label?: string) => ({
    id: makeEditorId(),
    labelUnitId,
    label,
  });

  const createLocalHeadingNode = (
    title: string,
    language: string,
  ): EditorNode => {
    const normalized = normalizeLanguage(language) ?? DEFAULT_LANGUAGE;
    return {
      id: makeEditorId(),
      labelTranslations: {
        translations: { [normalized]: title },
        fallbackLanguage: normalized,
      },
    };
  };

  const openAddDialog = (target: AddTreeNodeTarget = { kind: "root" }) => {
    setAddTarget(target);
    setSearch("");
    setCreateTitle("");
    setError(null);
    setAddOpen(true);
  };

  const closeAddDialog = () => {
    setAddOpen(false);
    setSearch("");
    setCreateTitle("");
  };

  const insertAndClose = (nextNode: EditorNode) => {
    insertAtTarget(addTarget, nextNode);
    closeAddDialog();
  };

  const createPublicLabel = async () => {
    const title = createTitle.trim();
    if (!title) return;
    setError(null);
    try {
      const language = normalizeLanguage(labelLanguage) ?? authoringLanguage;
      const created = await unitApi.create({
        type: "LABEL",
        isLanguageNeutral: true,
        translations: [{ language, title }],
      });
      insertAndClose(createPublicLabelNode(created.id, title));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(message);
      toast.error(message);
    }
  };

  const createPublicTag = async () => {
    const title = createTitle.trim();
    if (!title) return;
    setError(null);
    try {
      const language = normalizeLanguage(labelLanguage) ?? authoringLanguage;
      const created = await tagApi.create({
        translations: [{ language, title }],
      });
      insertAndClose(createTagNode({ tagId: created.tagUnitId, label: title }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(message);
      toast.error(message);
    }
  };

  const createLocalHeading = () => {
    const title = createTitle.trim();
    if (!title) return;
    insertAndClose(createLocalHeadingNode(title, labelLanguage));
  };

  const onMove: MoveHandler<EditorNode> = ({ dragIds, parentId, index }) => {
    const removed: EditorNode[] = [];
    const remove = (items: EditorNode[]): EditorNode[] =>
      items.flatMap((item) => {
        if (dragIds.includes(item.id)) {
          removed.push(item);
          return [];
        }
        return [
          item.children?.length
            ? { ...item, children: remove(item.children) }
            : item,
        ];
      });
    const insert = (items: EditorNode[]): EditorNode[] => {
      if (parentId === null) {
        const next = [...items];
        next.splice(index, 0, ...removed);
        return next;
      }
      return items.map((item) => {
        if (item.id === parentId) {
          const children = [...(item.children ?? [])];
          children.splice(index, 0, ...removed);
          return { ...item, children };
        }
        return item.children?.length
          ? { ...item, children: insert(item.children) }
          : item;
      });
    };
    setNodes((current) => insert(remove(current)));
    enqueueOp("move", dragIds[0], { parentId, index, count: dragIds.length });
  };

  const moveDepth = (nodeId: string, direction: "indent" | "outdent") => {
    setNodes((current) => {
      const clone = structuredClone(current) as EditorNode[];

      const indent = (items: EditorNode[]): boolean => {
        const index = items.findIndex((item) => item.id === nodeId);
        if (index > 0) {
          const [item] = items.splice(index, 1);
          const previous = items[index - 1];
          previous.children = [...(previous.children ?? []), item];
          return true;
        }
        return items.some((item) => item.children && indent(item.children));
      };

      const outdent = (
        items: EditorNode[],
        parentItems?: EditorNode[],
      ): boolean => {
        for (let index = 0; index < items.length; index += 1) {
          const item = items[index];
          if (item.id === nodeId && parentItems) {
            const [moved] = items.splice(index, 1);
            const parentIndex = parentItems.findIndex(
              (candidate) => candidate.children === items,
            );
            parentItems.splice(parentIndex + 1, 0, moved);
            return true;
          }
          if (item.children && outdent(item.children, items)) return true;
        }
        return false;
      };

      return direction === "indent"
        ? indent(clone)
          ? clone
          : current
        : outdent(clone)
          ? clone
          : current;
    });
    enqueueOp(direction, nodeId);
  };

  const moveNodeToParent = (
    nodeId: string,
    targetParentId: string | number | null,
  ) => {
    setNodes((current) => {
      const removed: EditorNode[] = [];
      const remove = (items: EditorNode[]): EditorNode[] =>
        items.flatMap((item) => {
          if (item.id === nodeId) {
            removed.push(item);
            return [];
          }
          return [
            item.children ? { ...item, children: remove(item.children) } : item,
          ];
        });
      const insert = (items: EditorNode[]): EditorNode[] => {
        if (targetParentId === null) return [...items, ...removed];
        return items.map((item) => {
          if (item.id === targetParentId) {
            return {
              ...item,
              children: [...(item.children ?? []), ...removed],
            };
          }
          return item.children
            ? { ...item, children: insert(item.children) }
            : item;
        });
      };
      return insert(remove(current));
    });
    enqueueOp("moveTo", nodeId, { parentId: targetParentId });
    if (targetParentId !== null) {
      window.setTimeout(() => treeRef.current?.open(String(targetParentId)), 0);
    }
  };

  const moveSiblingToEdge = (nodeId: string, edge: "first" | "last") => {
    setNodes((current) => {
      const clone = structuredClone(current) as EditorNode[];

      const visit = (items: EditorNode[]): boolean => {
        const index = items.findIndex((item) => item.id === nodeId);
        if (index >= 0) {
          const [item] = items.splice(index, 1);
          if (!item) return false;
          if (edge === "first") items.unshift(item);
          else items.push(item);
          return true;
        }
        return items.some((item) => item.children && visit(item.children));
      };

      return visit(clone) ? clone : current;
    });
    enqueueOp(edge === "first" ? "moveToFirst" : "moveToLast", nodeId);
  };

  const save = async () => {
    setError(null);
    try {
      await setValue.mutateAsync({
        realmId,
        key: "tagTree",
        value: serializedNodes,
      });
      setSavedNodes(nodes);
      setOpLog((current) => clearTreeEditOpLog(current));
      toast.success(getI18nRuntime().i18n.t("entity:realm_tag_tree_saved"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(message);
      toast.error(message);
    }
  };

  const downloadJson = () => {
    const blob = new Blob([prettyJson(serializedNodes)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "realm-tag-tree.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const uploadJson = async (file: File | null) => {
    if (!file) return;
    setError(null);
    try {
      const parsed = JSON.parse(await file.text()) as TagTreeNode[];
      if (!Array.isArray(parsed)) {
        throw new Error("Uploaded tagTree JSON must be an array.");
      }
      await setValue.mutateAsync({ realmId, key: "tagTree", value: parsed });
      const next = toEditorNodes(parsed);
      setNodes(next);
      setSavedNodes(next);
      setOpLog(emptyTreeEditOpLog);
      toast.success(getI18nRuntime().i18n.t("entity:realm_tag_tree_saved"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(message);
      toast.error(message);
    } finally {
      if (uploadRef.current) uploadRef.current.value = "";
    }
  };

  const findNode = (
    items: EditorNode[],
    id: string | null,
  ): EditorNode | null => {
    if (!id) return null;
    for (const item of items) {
      if (item.id === id) return item;
      const child = item.children?.length ? findNode(item.children, id) : null;
      if (child) return child;
    }
    return null;
  };

  const pendingDeleteNode = findNode(nodes, pendingDeleteId);
  const moveToNode = findNode(nodes, moveToNodeId);
  const confirmDeleteNode = () => {
    if (!pendingDeleteId) return;
    deleteNodeById(pendingDeleteId);
    setPendingDeleteId(null);
  };
  const cancelPendingOps = () => {
    setNodes(savedNodes);
    setOpLog((current) => clearTreeEditOpLog(current));
  };

  function Node({ node, style, dragHandle }: NodeRendererProps<EditorNode>) {
    const hasChildren = (node.children?.length ?? 0) > 0;
    const isSubtreeEnd = !!(
      node.parent &&
      !node.parent.isRoot &&
      (!node.next || !node.parent.isAncestorOf(node.next))
    );
    const label = nodeLabel(node.data);
    const kind = node.data.tagId
      ? "Tag"
      : node.data.labelUnitId
        ? "Label"
        : "Local";
    const actionItems: TreeActionItem[] = [
      {
        key: "addSiblingAfter",
        label: "Add sibling",
        icon: <Plus className="size-4" aria-hidden />,
        onSelect: () =>
          openAddDialog({ kind: "siblingAfter", nodeId: node.data.id }),
      },
      {
        key: "addChild",
        label: "Add child",
        icon: <ListTree className="size-4" aria-hidden />,
        onSelect: () => openAddDialog({ kind: "child", nodeId: node.data.id }),
      },
      {
        key: "moveTo",
        label: "Move to...",
        separatorBefore: true,
        onSelect: () => setMoveToNodeId(node.data.id),
      },
      {
        key: "indent",
        label: "Indent",
        icon: <ChevronRight className="size-4" aria-hidden />,
        onSelect: () => moveDepth(node.data.id, "indent"),
      },
      {
        key: "outdent",
        label: "Outdent",
        icon: <ChevronLeft className="size-4" aria-hidden />,
        onSelect: () => moveDepth(node.data.id, "outdent"),
      },
      {
        key: "moveToFirst",
        label: "Move to first",
        onSelect: () => moveSiblingToEdge(node.data.id, "first"),
      },
      {
        key: "moveToLast",
        label: "Move to last",
        onSelect: () => moveSiblingToEdge(node.data.id, "last"),
      },
      {
        key: "delete",
        label: "Delete",
        icon: <Trash2 className="size-4" aria-hidden />,
        separatorBefore: true,
        destructive: true,
        onSelect: () => setPendingDeleteId(node.data.id),
      },
    ];

    return (
      <div style={{ ...style, paddingLeft: 0 }} className="h-full">
        <TreeEditorRow
          label={label}
          meta={kind}
          leadingIcon={
            node.data.tagId ? (
              <Tag className="size-4" aria-hidden />
            ) : node.data.labelUnitId ? (
              <Type className="size-4" aria-hidden />
            ) : (
              <ListTree className="size-4" aria-hidden />
            )
          }
          actions={actionItems}
          hasChildren={hasChildren}
          expanded={node.isOpen}
          draggable
          dragHandle={dragHandle}
          onToggle={() => node.toggle()}
          subtreeEnd={isSubtreeEnd}
        />
      </div>
    );
  }

  return (
    <div className="flex max-h-[clamp(360px,58dvh,720px)] min-h-0 flex-col gap-3 rounded-md bg-surface-subtle p-4">
      <div className="shrink-0">
        <h3 className="text-sm font-medium leading-ui text-text-primary">
          {getI18nRuntime().i18n.t("entity:realm_tag_tree")}
        </h3>
        <p className="mt-1 text-sm leading-body text-text-secondary">
          {getI18nRuntime().i18n.t("entity:realm_tag_tree_description")}
        </p>
        <p className="mt-1 text-xs leading-dense text-text-tertiary">
          Deleting a node is the supported way to remove it from tag tree
          surfaces; hidden disabled nodes are not preserved.
        </p>
      </div>

      <div className="grid shrink-0 gap-2 md:grid-cols-[10rem_minmax(0,1fr)_auto_auto_auto] md:items-end">
        <div>
          <Label htmlFor="realm-tag-tree-label-language">Label language</Label>
          <Input
            id="realm-tag-tree-label-language"
            value={labelLanguage}
            onChange={(event) =>
              setLabelLanguage(
                normalizeLanguage(event.target.value) ?? DEFAULT_LANGUAGE,
              )
            }
          />
        </div>
        <div className="hidden md:block" />
        <Button type="button" variant="outline" onClick={() => openAddDialog()}>
          <Plus className="mr-2 size-4" aria-hidden />
          Add item
        </Button>
        <Button type="button" variant="outline" onClick={downloadJson}>
          <Download className="mr-2 size-4" aria-hidden />
          JSON
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => uploadRef.current?.click()}
        >
          <Upload className="mr-2 size-4" aria-hidden />
          JSON
        </Button>
        <input
          ref={uploadRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => void uploadJson(event.target.files?.[0] ?? null)}
        />
      </div>

      <div
        ref={treeAreaCallbackRef}
        className="min-h-0 flex-1 overflow-hidden rounded-sm bg-surface-base"
      >
        {nodes.length === 0 ? (
          <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 text-sm leading-ui text-text-secondary">
            <ListTree className="size-6 text-text-tertiary" aria-hidden />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => openAddDialog()}
            >
              <Plus className="mr-2 size-4" aria-hidden />
              Add first item
            </Button>
          </div>
        ) : (
          <Tree<EditorNode>
            ref={treeRef}
            onMove={onMove}
            data={ensureTreeChildren(nodes)}
            width={treeSize.width}
            height={treeSize.height}
            indent={TREE_DROP_INDENT}
            rowHeight={46}
            idAccessor={(node) => node.id}
            childrenAccessor="children"
            className="overflow-auto"
          >
            {Node}
          </Tree>
        )}
      </div>

      {error ? (
        <p className="text-sm leading-ui text-error-text">{error}</p>
      ) : null}
      <TreeEditorFooter
        pendingCount={opLog.entries.length}
        saving={setValue.isPending}
        onCancel={cancelPendingOps}
        onSave={save}
        summary={
          <span>
            {nodes.length} root {nodes.length === 1 ? "item" : "items"}
          </span>
        }
        saveLabel={getI18nRuntime().i18n.t("entity:realm_save_tag_tree")}
      />

      <TreeMoveToDialog
        open={moveToNode !== null}
        nodes={nodes}
        movingNode={moveToNode}
        getLabel={nodeLabel}
        onClose={() => setMoveToNodeId(null)}
        onConfirm={(targetParentId) => {
          if (moveToNodeId) moveNodeToParent(moveToNodeId, targetParentId);
        }}
      />

      <Dialog
        open={addOpen}
        onOpenChange={(open) => (open ? null : closeAddDialog())}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add tag tree item</DialogTitle>
            <DialogDescription>
              Search existing labels or tags first. Create a new item only when
              the catalog does not already have the term you need.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="realm-tag-tree-add-search">Search</Label>
              <Input
                id="realm-tag-tree-add-search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setCreateTitle(event.target.value);
                }}
                placeholder="Search labels and tags"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex min-h-32 flex-col gap-2 rounded-md bg-surface-subtle p-3">
                <div className="flex items-center gap-2 text-sm font-medium leading-ui text-text-primary">
                  <Type className="size-4 text-text-tertiary" aria-hidden />
                  Labels
                </div>
                {labelSearchLoading && searchTerm ? (
                  <p className="text-sm leading-body text-text-secondary">
                    Searching labels...
                  </p>
                ) : null}
                {!labelSearchLoading &&
                searchTerm &&
                labelResults.length === 0 ? (
                  <p className="text-sm leading-body text-text-secondary">
                    No matching labels.
                  </p>
                ) : null}
                {labelResults.map((unit) => (
                  <Button
                    key={unit.id}
                    type="button"
                    variant="ghost"
                    className="h-auto justify-start px-2 py-2 text-left"
                    onClick={() =>
                      insertAndClose(
                        createPublicLabelNode(unit.id, unitLabel(unit)),
                      )
                    }
                  >
                    <span className="min-w-0 truncate">{unitLabel(unit)}</span>
                  </Button>
                ))}
              </div>

              <div className="flex min-h-32 flex-col gap-2 rounded-md bg-surface-subtle p-3">
                <div className="flex items-center gap-2 text-sm font-medium leading-ui text-text-primary">
                  <Tag className="size-4 text-text-tertiary" aria-hidden />
                  Tags
                </div>
                {tagSearchLoading && searchTerm ? (
                  <p className="text-sm leading-body text-text-secondary">
                    Searching tags...
                  </p>
                ) : null}
                {!tagSearchLoading && searchTerm && tagResults.length === 0 ? (
                  <p className="text-sm leading-body text-text-secondary">
                    No matching tags.
                  </p>
                ) : null}
                {tagResults.map((unit) => (
                  <Button
                    key={unit.id}
                    type="button"
                    variant="ghost"
                    className="h-auto justify-start px-2 py-2 text-left"
                    onClick={() =>
                      insertAndClose(
                        createTagNode({
                          tagId: unit.id,
                          label: unitLabel(unit),
                        }),
                      )
                    }
                  >
                    <span className="min-w-0 truncate">{unitLabel(unit)}</span>
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="realm-tag-tree-create-title">
                Create fallback
              </Label>
              <Input
                id="realm-tag-tree-create-title"
                value={createTitle}
                onChange={(event) => setCreateTitle(event.target.value)}
                placeholder="Name"
              />
              <div className="grid gap-2 sm:grid-cols-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!createTitle.trim()}
                  onClick={() => void createPublicLabel()}
                >
                  Create public label
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!createTitle.trim()}
                  onClick={() => void createPublicTag()}
                >
                  Create tag
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!createTitle.trim()}
                  onClick={createLocalHeading}
                >
                  Use local heading
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={closeAddDialog}>
              {getI18nRuntime().i18n.t("common:cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete tag tree item?</DialogTitle>
            <DialogDescription>
              {pendingDeleteNode
                ? `This removes "${nodeLabel(pendingDeleteNode)}" from the tag tab tree. Save the tag tree to publish the change.`
                : "This removes the selected tag tree item. Save the tag tree to publish the change."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDeleteId(null)}>
              {getI18nRuntime().i18n.t("common:cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmDeleteNode}>
              {getI18nRuntime().i18n.t("common:delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function SlotPicker({
  realmId,
  slotKey,
  value,
}: {
  realmId: string;
  slotKey: "rule" | "about";
  value?: string | null;
}) {
  const [selected, setSelected] = useState(value ?? "");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const setValue = useSetRealmExtraValueMutation();
  const clearValue = useClearRealmExtraValueMutation();
  const readContext = useReadLanguageContext();
  const searchTerm = search.trim();
  const { data } = useQuery({
    ...unitQueries.search(searchTerm, {
      type: "POST",
      languages: readContext.languages,
      appLocale: readContext.appLocale,
      languageMode: readContext.languageMode,
      limit: 8,
    }),
    enabled: readContext.ready && Boolean(searchTerm),
  });

  useEffect(() => {
    setSelected(value ?? "");
  }, [value]);

  const save = async () => {
    setError(null);
    try {
      if (selected) {
        await setValue.mutateAsync({ realmId, key: slotKey, value: selected });
      } else {
        await clearValue.mutateAsync({ realmId, key: slotKey });
      }
      toast.success(
        slotKey === "rule"
          ? getI18nRuntime().i18n.t("entity:realm_rule_saved")
          : getI18nRuntime().i18n.t("entity:realm_about_saved"),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(message);
      toast.error(message);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-md bg-surface-subtle p-4">
      <Label>
        {slotKey === "rule"
          ? getI18nRuntime().i18n.t("entity:realm_rule_post")
          : getI18nRuntime().i18n.t("entity:realm_about_post")}
      </Label>
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={getI18nRuntime().i18n.t(
          "community:post_search_placeholder",
        )}
      />
      {searchTerm && data?.units?.length ? (
        <div className="flex flex-col gap-2">
          {data.units.map((unit) => (
            <Button
              key={unit.id}
              type="button"
              size="sm"
              variant={selected === unit.id ? "default" : "secondary"}
              className="justify-start"
              onClick={() => setSelected(unit.id)}
            >
              {unitLabel(unit)}
            </Button>
          ))}
        </div>
      ) : null}
      {selected && (
        <p className="text-sm leading-ui text-text-secondary">
          {getI18nRuntime().i18n.t("common:selected_id", { id: selected })}
        </p>
      )}
      {selected ? <RealmSlotTranslationEditor unitId={selected} /> : null}
      <div className="flex justify-end gap-2">
        {error && (
          <p className="mr-auto text-sm leading-ui text-error-text">{error}</p>
        )}
        <Button type="button" variant="ghost" onClick={() => setSelected("")}>
          {getI18nRuntime().i18n.t("common:clear")}
        </Button>
        <Button
          type="button"
          onClick={save}
          disabled={setValue.isPending || clearValue.isPending}
        >
          {getI18nRuntime().i18n.t("common:save")}
        </Button>
      </div>
    </div>
  );
}

function RealmSlotTranslationEditor({ unitId }: { unitId: string }) {
  const queryClient = useQueryClient();
  const detailQuery = useQuery(unitDetailQuery(unitId));
  const initial = useMemo<TranslationEditorEntry[]>(() => {
    if (!detailQuery.data?.translations?.length) {
      return [{ language: DEFAULT_LANGUAGE }];
    }
    return detailQuery.data.translations.map((translation) => ({
      language: translation.language,
      title: translation.title ?? "",
      subtitle: translation.subtitle ?? "",
      summary: translation.summary ?? "",
      description: contentDocMarkdownFallback(translation.description),
    }));
  }, [detailQuery.data?.translations]);
  const [drafts, setDrafts] = useState<TranslationEditorEntry[]>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(initial);
  }, [initial]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      for (const draft of drafts) {
        const language = normalizeLanguage(draft.language);
        if (!language) continue;
        await unitApi.upsertTranslation(unitId, language, {
          title: draft.title ?? null,
          subtitle: draft.subtitle ?? null,
          summary: draft.summary ?? null,
          description: markdownContentDoc(draft.description ?? ""),
        });
      }
      await queryClient.invalidateQueries({
        queryKey: unitDetailQuery(unitId).queryKey,
      });
      toast.success("Translations saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-md bg-surface-base p-3">
      <h4 className="text-sm font-medium leading-ui text-text-primary">
        Translations
      </h4>
      {detailQuery.isLoading ? (
        <div className="mt-3 h-24 rounded-sm bg-surface-subtle" />
      ) : detailQuery.isError ? (
        <p className="mt-3 text-sm leading-body text-error-text">
          Unable to load translations.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <TranslationEditor translations={drafts} onChange={setDrafts} />
          {error ? (
            <p className="text-sm leading-body text-error-text">{error}</p>
          ) : null}
          <div className="flex justify-end">
            <Button type="button" onClick={save} disabled={saving}>
              {getI18nRuntime().i18n.t("common:save")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

type RealmImageExtraKey = "avatar" | "banner";

function RealmImagePicker({
  realmId,
  extraKey,
  label,
  savedMessage,
  value,
}: {
  realmId: string;
  extraKey: RealmImageExtraKey;
  label: string;
  savedMessage: string;
  value?: RealmBannerExtra | RealmAvatarExtra | null;
}) {
  const [url, setUrl] = useState(value?.kind === "url" ? value.url : "");
  const setValue = useSetRealmExtraValueMutation();
  const clearValue = useClearRealmExtraValueMutation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUrl(value?.kind === "url" ? value.url : "");
  }, [value]);

  const save = async () => {
    setError(null);
    try {
      if (url.trim()) {
        await setValue.mutateAsync({
          realmId,
          key: extraKey,
          value: { kind: "url", url: url.trim() },
        });
      } else {
        await clearValue.mutateAsync({ realmId, key: extraKey });
      }
      toast.success(savedMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(message);
      toast.error(message);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-md bg-surface-subtle p-4">
      <Label>{label}</Label>
      <Input
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder={getI18nRuntime().i18n.t(
          "entity:realm_direct_image_url_placeholder",
        )}
      />
      <div className="flex justify-end gap-2">
        {error && (
          <p className="mr-auto text-sm leading-ui text-error-text">{error}</p>
        )}
        <Button type="button" variant="ghost" onClick={() => setUrl("")}>
          {getI18nRuntime().i18n.t("common:clear")}
        </Button>
        <Button
          type="button"
          onClick={save}
          disabled={setValue.isPending || clearValue.isPending}
        >
          {getI18nRuntime().i18n.t("common:save")}
        </Button>
      </div>
    </div>
  );
}

export function BannerPicker({
  realmId,
  value,
}: {
  realmId: string;
  value?: RealmBannerExtra | null;
}) {
  return (
    <RealmImagePicker
      realmId={realmId}
      extraKey="banner"
      label={getI18nRuntime().i18n.t("entity:realm_banner")}
      savedMessage={getI18nRuntime().i18n.t("entity:realm_banner_saved")}
      value={value}
    />
  );
}

export function AvatarPicker({
  realmId,
  value,
}: {
  realmId: string;
  value?: RealmAvatarExtra | null;
}) {
  return (
    <RealmImagePicker
      realmId={realmId}
      extraKey="avatar"
      label={getI18nRuntime().i18n.t("entity:realm_avatar")}
      savedMessage={getI18nRuntime().i18n.t("entity:realm_avatar_saved")}
      value={value}
    />
  );
}
