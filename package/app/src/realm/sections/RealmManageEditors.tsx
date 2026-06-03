import {
  useClearRealmExtraValueMutation,
  useSetRealmExtraValueMutation,
} from "@rezics/api/realm/realm-extra.mutations";
import { tagQueries } from "@rezics/api/tag/tag";
import { unitApi, unitQueries } from "@rezics/api/unit/unit";
import { unitDetailQuery } from "@rezics/api/unit/unit.queries";
import { useUpdateZone, zoneByUnitIdQueryOptions } from "@rezics/api/zone/zone";
import type {
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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  GripVertical,
  ListTree,
  Plus,
  Save,
  Search,
  Tag,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MoveHandler, NodeRendererProps, TreeApi } from "react-arborist";
import { Tree } from "react-arborist";
import { toast } from "sonner";
import { useAuthoringLanguageDefault } from "@/shared/hooks/useAuthoringLanguageDefault";
import { useReadLanguageCandidates } from "@/shared/hooks/useReadLanguageCandidates";
import { getTranslation } from "@/shared/utils/translation-helpers";

type TagSearchResult = {
  unitId?: string;
  tagUnitId?: string;
  label?: string;
  slug?: string;
};

function nodeLabel(node: TagTreeNode) {
  return (
    node.label?.trim() ||
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
  const languages = useReadLanguageCandidates();
  const labelSearchTerm = labelSearch.trim();
  const { data: labelSearchData } = useQuery(
    unitQueries.search(labelSearchTerm, { type: "LABEL", languages, limit: 8 }),
  );

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
          children: item.children?.length ? visit(item.children) : undefined,
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
  const [labelLanguage, setLabelLanguage] = useState(DEFAULT_LANGUAGE);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const treeRef = useRef<TreeApi<EditorNode> | null>(null);
  const treeAreaRef = useRef<HTMLDivElement | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [treeSize, setTreeSize] = useState({ width: 0, height: 360 });
  const setValue = useSetRealmExtraValueMutation();
  const searchTerm = search.trim();
  const { data: searchData } = useQuery(tagQueries.search(searchTerm));
  const serializedNodes = useMemo(
    () => toTagTreeNodes(nodes),
    [nodes, toTagTreeNodes],
  );

  const existingTagIds = useMemo(() => {
    const ids = new Set<string>();
    const visit = (items: EditorNode[]) => {
      for (const item of items) {
        if (item.tagId) ids.add(item.tagId);
        if (item.children?.length) visit(item.children);
      }
    };
    visit(nodes);
    return ids;
  }, [nodes]);

  const results = useMemo(() => {
    return ((searchData?.tags ?? []) as TagSearchResult[]).flatMap((tag) => {
      const tagId = tag.unitId ?? tag.tagUnitId;
      if (!tagId || existingTagIds.has(tagId)) return [];
      return [{ tagId, label: tag.label ?? tag.slug ?? tagId.slice(0, 8) }];
    });
  }, [existingTagIds, searchData?.tags]);

  useEffect(() => {
    setNodes(toEditorNodes(initialValue));
  }, [initialValue, toEditorNodes]);

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
  };

  const addChild = (parentId: string, nextNode: EditorNode) => {
    updateNodeById(parentId, (node) => ({
      ...node,
      children: [...(node.children ?? []), nextNode],
    }));
    window.setTimeout(() => treeRef.current?.open(parentId), 0);
  };

  const createLabelNode = (): EditorNode => ({
    id: makeEditorId(),
    label: "New group",
  });

  const createTagNode = (tag: {
    tagId: string;
    label?: string;
  }): EditorNode => ({
    id: makeEditorId(),
    tagId: tag.tagId,
    label: tag.label,
  });

  const updateNodeLabelTranslation = (
    id: string,
    language: string,
    value: string,
  ) => {
    const normalized = normalizeLanguage(language) ?? DEFAULT_LANGUAGE;
    updateNodeById(id, (node) => {
      const translations = {
        ...(node.labelTranslations?.translations ?? {}),
      };
      if (value.trim()) translations[normalized] = value;
      else delete translations[normalized];
      return {
        ...node,
        labelTranslations: {
          translations,
          fallbackLanguage:
            node.labelTranslations?.fallbackLanguage ?? normalized,
        },
      };
    });
  };

  const onMove: MoveHandler<EditorNode> = useCallback(
    ({ dragIds, parentId, index }) => {
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
    },
    [],
  );

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
  };

  const save = async () => {
    setError(null);
    try {
      await setValue.mutateAsync({
        realmId,
        key: "tagTree",
        value: serializedNodes,
      });
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
      setNodes(toEditorNodes(parsed));
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
  const confirmDeleteNode = () => {
    if (!pendingDeleteId) return;
    deleteNodeById(pendingDeleteId);
    setPendingDeleteId(null);
  };

  function Node({ node, style, dragHandle }: NodeRendererProps<EditorNode>) {
    const language = normalizeLanguage(labelLanguage) ?? DEFAULT_LANGUAGE;
    const translation =
      node.data.labelTranslations?.translations[language] ?? "";
    const hasChildren = (node.children?.length ?? 0) > 0;
    return (
      <div
        style={style}
        className="group flex h-full min-w-0 items-center gap-2 border-b border-border-whisper bg-surface-base px-2 text-sm leading-dense text-text-primary hover:bg-surface-subtle"
      >
        <span
          ref={dragHandle}
          className="flex size-7 cursor-grab items-center justify-center rounded-sm text-text-tertiary"
        >
          <GripVertical className="size-4" aria-hidden />
        </span>
        <button
          type="button"
          className="flex size-7 items-center justify-center rounded-sm text-text-tertiary hover:bg-surface-elevated hover:text-text-primary"
          onClick={() => node.toggle()}
          aria-label={hasChildren ? "Toggle children" : "No children"}
        >
          {hasChildren ? (
            node.isOpen ? (
              <ChevronDown className="size-4" aria-hidden />
            ) : (
              <ChevronRight className="size-4" aria-hidden />
            )
          ) : (
            <span className="size-4" />
          )}
        </button>
        <span className="flex size-7 items-center justify-center rounded-sm bg-surface-subtle text-text-tertiary">
          {node.data.tagId ? (
            <Tag className="size-4" aria-hidden />
          ) : (
            <ListTree className="size-4" aria-hidden />
          )}
        </span>
        <Input
          value={node.data.label ?? ""}
          onChange={(event) =>
            updateNodeById(node.data.id, (item) => ({
              ...item,
              label: event.target.value,
            }))
          }
          placeholder={node.data.tagId ? "Tag display label" : "Group label"}
          className="h-8 min-w-0 flex-1"
        />
        <Input
          value={translation}
          onChange={(event) =>
            updateNodeLabelTranslation(
              node.data.id,
              labelLanguage,
              event.target.value,
            )
          }
          placeholder={`Label (${language})`}
          className="hidden h-8 min-w-0 flex-1 lg:block"
        />
        <Input
          value={node.data.tagId ?? ""}
          onChange={(event) =>
            updateNodeById(node.data.id, (item) => ({
              ...item,
              tagId: event.target.value.trim() || undefined,
            }))
          }
          placeholder="Tag Unit ID"
          className="hidden h-8 min-w-0 flex-1 xl:block"
        />
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8"
            onClick={() => insertSiblingAfter(node.data.id, createLabelNode())}
            aria-label="Add sibling"
          >
            <Plus className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8"
            onClick={() => addChild(node.data.id, createLabelNode())}
            aria-label="Add child"
          >
            <ListTree className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8"
            onClick={() => moveDepth(node.data.id, "indent")}
            aria-label="Indent"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8"
            onClick={() => moveDepth(node.data.id, "outdent")}
            aria-label="Outdent"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 text-error-text hover:text-error-text"
            onClick={() => setPendingDeleteId(node.data.id)}
            aria-label="Delete"
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
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
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="realm-tag-tree-search">Bind tag</Label>
          <Input
            id="realm-tag-tree-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={getI18nRuntime().i18n.t(
              "community:tag_search_placeholder",
            )}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setNodes((current) => [...current, createLabelNode()])}
        >
          <Plus className="mr-2 size-4" aria-hidden />
          Group
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

      {searchTerm && results.length > 0 ? (
        <div className="flex shrink-0 flex-wrap gap-2">
          {results.map((tagResult) => (
            <Button
              key={tagResult.tagId}
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setNodes((current) => [
                  ...current,
                  createTagNode({
                    tagId: tagResult.tagId,
                    label: tagResult.label,
                  }),
                ]);
                setSearch("");
              }}
            >
              <Search className="mr-2 size-4" aria-hidden />
              {tagResult.label}
            </Button>
          ))}
        </div>
      ) : null}

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
              onClick={() =>
                setNodes((current) => [...current, createLabelNode()])
              }
            >
              <Plus className="mr-2 size-4" aria-hidden />
              Add first group
            </Button>
          </div>
        ) : (
          <Tree<EditorNode>
            ref={treeRef}
            data={nodes}
            onMove={onMove}
            width={treeSize.width}
            height={treeSize.height}
            indent={24}
            rowHeight={46}
            idAccessor={(node) => node.id}
            childrenAccessor="children"
            className="overflow-auto"
          >
            {Node}
          </Tree>
        )}
      </div>

      <div className="flex shrink-0 justify-end">
        {error && (
          <p className="mr-auto text-sm leading-ui text-error-text">{error}</p>
        )}
        <Button onClick={save} disabled={setValue.isPending}>
          <Save className="mr-2 size-4" aria-hidden />
          {getI18nRuntime().i18n.t("entity:realm_save_tag_tree")}
        </Button>
      </div>

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
  const languages = useReadLanguageCandidates();
  const searchTerm = search.trim();
  const { data } = useQuery(
    unitQueries.search(searchTerm, { type: "POST", languages, limit: 8 }),
  );

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

export function BannerPicker({
  realmId,
  value,
}: {
  realmId: string;
  value?: RealmBannerExtra | null;
}) {
  const [url, setUrl] = useState(value?.kind === "url" ? value.url : "");
  const [postId, setPostId] = useState(
    value?.kind === "post" ? value.unitId : "",
  );
  const setValue = useSetRealmExtraValueMutation();
  const clearValue = useClearRealmExtraValueMutation();
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const languages = useReadLanguageCandidates();
  const searchTerm = search.trim();
  const { data } = useQuery(
    unitQueries.search(searchTerm, { type: "POST", languages, limit: 8 }),
  );

  useEffect(() => {
    setUrl(value?.kind === "url" ? value.url : "");
    setPostId(value?.kind === "post" ? value.unitId : "");
  }, [value]);

  const save = async () => {
    setError(null);
    try {
      if (url.trim()) {
        await setValue.mutateAsync({
          realmId,
          key: "banner",
          value: { kind: "url", url: url.trim() },
        });
      } else if (postId) {
        await setValue.mutateAsync({
          realmId,
          key: "banner",
          value: { kind: "post", unitId: postId },
        });
      } else {
        await clearValue.mutateAsync({ realmId, key: "banner" });
      }
      toast.success(getI18nRuntime().i18n.t("entity:realm_banner_saved"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(message);
      toast.error(message);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-md bg-surface-subtle p-4">
      <Label>{getI18nRuntime().i18n.t("entity:realm_banner")}</Label>
      <Input
        value={url}
        onChange={(event) => {
          setUrl(event.target.value);
          if (event.target.value.trim()) setPostId("");
        }}
        placeholder={getI18nRuntime().i18n.t(
          "entity:realm_direct_image_url_placeholder",
        )}
      />
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
              variant={postId === unit.id ? "default" : "secondary"}
              className="justify-start"
              onClick={() => {
                setPostId(unit.id);
                setUrl("");
              }}
            >
              {unitLabel(unit)}
            </Button>
          ))}
        </div>
      ) : null}
      {postId && (
        <p className="text-sm leading-ui text-text-secondary">
          {getI18nRuntime().i18n.t("entity:realm_selected_post", {
            id: postId,
          })}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {error && (
          <p className="mr-auto text-sm leading-ui text-error-text">{error}</p>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setUrl("");
            setPostId("");
          }}
        >
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
