import {
  useClearRealmExtraValueMutation,
  useSetRealmExtraValueMutation,
} from "@rezics/api/realm/realm-extra.mutations";
import { tagQueries } from "@rezics/api/tag/tag";
import { unitApi, unitQueries } from "@rezics/api/unit/unit";
import { unitDetailQuery } from "@rezics/api/unit/unit.queries";
import { useCreateWorkRealmContext } from "@rezics/api/work-realm-context/work-realm-context";
import { useUpdateZone, zoneByUnitIdQueryOptions } from "@rezics/api/zone/zone";
import {
  contentDocMarkdownFallback,
  DEFAULT_LANGUAGE,
  markdownContentDoc,
  normalizeLanguage,
  workRealmContextRoleValues,
} from "@rezics/contract";
import type {
  RealmBannerExtra,
  RealmExtra,
  RealmTagView,
  RealmTagViewStyle,
  TagTreeNode,
  UnitDTO,
  WorkRealmContextRole,
  WikiZoneConfig,
  WikiZoneHomepageSection,
  WikiZoneNavigation,
  WikiZoneTheme,
} from "@rezics/contract";
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
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getTranslation } from "@/shared/utils/translation-helpers";

import { getI18nRuntime } from "@rezics/i18n/runtime";
export interface RealmExtraManageSectionProps {
  realmId: string;
  extra?: RealmExtra | null;
}

type TagSearchResult = {
  unitId?: string;
  tagUnitId?: string;
  label?: string;
  slug?: string;
};

function nodeLabel(node: TagTreeNode) {
  return node.label?.trim() || node.tagId?.slice(0, 8) || getI18nRuntime().i18n.t("common:untitled");
}

function nodeKey(node: TagTreeNode) {
  return node.tagId ?? node.label ?? "untitled-node";
}

function unitLabel(unit: UnitDTO) {
  const tr = getTranslation(
    unit.translations,
    undefined,
    unit.defaultLanguage ?? undefined,
  );
  return tr?.title ?? unit.slug ?? unit.id;
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

export const RealmExtraManageSection: React.FC<
  RealmExtraManageSectionProps
> = ({ realmId, extra }) => {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold leading-ui text-text-primary">
          {getI18nRuntime().i18n.t("entity:realm_forum_settings")}
        </h2>
        <p className="mt-1 text-sm leading-body text-text-secondary">
          {getI18nRuntime().i18n.t("entity:realm_forum_settings_description")}
        </p>
      </div>
      <TagTreeEditor
        realmId={realmId}
        initialValue={extra?.tagTree as TagTreeNode[] | undefined}
      />
      <TagViewPreferenceEditor
        realmId={realmId}
        initialValue={extra?.tagView as RealmTagView | undefined}
      />
      <WikiZonePicker realmId={realmId} value={extra?.wikiZoneUnitId ?? null} />
      <WorkRealmContextCreator realmId={realmId} />
      <SlotPicker realmId={realmId} slotKey="rule" value={extra?.rule} />
      <SlotPicker realmId={realmId} slotKey="about" value={extra?.about} />
      <BannerPicker realmId={realmId} value={extra?.banner ?? null} />
    </section>
  );
};

function TagViewPreferenceEditor({
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

function WorkRealmContextCreator({ realmId }: { realmId: string }) {
  const [workUnitId, setWorkUnitId] = useState("");
  const [releaseUnitId, setReleaseUnitId] = useState("");
  const [role, setRole] = useState<WorkRealmContextRole>("community");
  const [locale, setLocale] = useState("");
  const [priority, setPriority] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const createContext = useCreateWorkRealmContext();

  const save = async () => {
    const workId = workUnitId.trim();
    if (!workId) return;
    const normalizedLocale = locale.trim()
      ? normalizeLanguage(locale.trim())
      : null;
    setError(null);
    try {
      await createContext.mutateAsync({
        workUnitId: workId,
        realmUnitId: realmId,
        role,
        priority: Number.parseInt(priority, 10) || 0,
        ...(normalizedLocale ? { locale: normalizedLocale } : {}),
        ...(releaseUnitId.trim()
          ? { releaseUnitId: releaseUnitId.trim() }
          : {}),
      });
      setWorkUnitId("");
      setReleaseUnitId("");
      setLocale("");
      setPriority("0");
      toast.success(getI18nRuntime().i18n.t("entity:realm_work_context_created"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(message);
      toast.error(message);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-md bg-surface-subtle p-4">
      <div>
        <Label>{getI18nRuntime().i18n.t("entity:realm_work_context_title")}</Label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Input
          value={workUnitId}
          onChange={(event) => setWorkUnitId(event.target.value)}
          placeholder={getI18nRuntime().i18n.t("entity:realm_work_context_work_placeholder")}
        />
        <Input
          value={releaseUnitId}
          onChange={(event) => setReleaseUnitId(event.target.value)}
          placeholder={getI18nRuntime().i18n.t("entity:realm_work_context_release_placeholder")}
        />
        <LabeledSelect
          label={getI18nRuntime().i18n.t("entity:realm_work_context_role")}
          value={role}
          options={workRealmContextRoleValues}
          onChange={setRole}
        />
        <Input
          value={locale}
          onChange={(event) => setLocale(event.target.value)}
          placeholder={getI18nRuntime().i18n.t("entity:realm_work_context_locale_placeholder")}
        />
        <LabeledInput
          label={getI18nRuntime().i18n.t("entity:realm_work_context_priority")}
          value={priority}
          onChange={setPriority}
        />
      </div>
      <div className="flex justify-end">
        {error && (
          <p className="mr-auto text-sm leading-ui text-error-text">{error}</p>
        )}
        <Button
          type="button"
          onClick={save}
          disabled={!workUnitId.trim() || createContext.isPending}
        >
          {getI18nRuntime().i18n.t("common:save")}
        </Button>
      </div>
    </div>
  );
}

function WikiZonePicker({
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
        placeholder={getI18nRuntime().i18n.t("entity:realm_wiki_zone_unit_id_placeholder")}
      />
      {trimmedZoneId && (
        <div className="rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm leading-ui">
          {zoneQuery.data ? (
            <div className="flex flex-col gap-1">
              <span className="font-medium text-text-primary">
                {zoneQuery.data.name || zoneQuery.data.slug}
              </span>
              <span className="text-text-secondary">
                {getI18nRuntime().i18n.t("common:selected_id", { id: trimmedZoneId })}
              </span>
            </div>
          ) : (
            <span className="text-text-secondary">
              {getI18nRuntime().i18n.t("common:selected_id", { id: trimmedZoneId })}
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

function WikiZoneConfigEditor({
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
  const labelSearchTerm = labelSearch.trim();
  const { data: labelSearchData } = useQuery(
    unitQueries.search(labelSearchTerm, { type: "LABEL", limit: 8 }),
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
      const message = getI18nRuntime().i18n.t("entity:realm_wiki_zone_invalid_json");
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
        defaultLanguage: DEFAULT_LANGUAGE,
        isLanguageNeutral: true,
        translations: [{ language: DEFAULT_LANGUAGE, title }],
      });
      insertLabel(created.id, labelTarget);
      setLabelTitle("");
      toast.success(getI18nRuntime().i18n.t("entity:realm_wiki_zone_label_created"));
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
        throw new Error(getI18nRuntime().i18n.t("entity:realm_wiki_zone_low_contrast"));
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
      toast.success(getI18nRuntime().i18n.t("entity:realm_wiki_zone_config_saved"));
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
          label={getI18nRuntime().i18n.t("entity:realm_wiki_zone_homepage_template")}
          value={homepageTemplate}
          options={wikiHomepageTemplateOptions}
          onChange={setHomepageTemplate}
        />
        <LabeledSelect
          label={getI18nRuntime().i18n.t("entity:realm_wiki_zone_theme_density")}
          value={density}
          options={densityOptions}
          onChange={setDensity}
        />
        <LabeledSelect
          label={getI18nRuntime().i18n.t("entity:realm_wiki_zone_theme_nav_position")}
          value={navPosition}
          options={navPositionOptions}
          onChange={setNavPosition}
        />
        <LabeledSelect
          label={getI18nRuntime().i18n.t("entity:realm_wiki_zone_theme_content_width")}
          value={contentWidth}
          options={contentWidthOptions}
          onChange={setContentWidth}
        />
        <LabeledSelect
          label={getI18nRuntime().i18n.t("entity:realm_wiki_zone_theme_infobox_position")}
          value={infoboxPosition}
          options={infoboxPositionOptions}
          onChange={setInfoboxPosition}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <LabeledInput
          label={getI18nRuntime().i18n.t("entity:realm_wiki_zone_theme_background")}
          value={background}
          onChange={setBackground}
        />
        <LabeledInput
          label={getI18nRuntime().i18n.t("entity:realm_wiki_zone_theme_surface")}
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
            {getI18nRuntime().i18n.t("entity:realm_wiki_zone_label_picker_description")}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_11rem]">
          <Input
            value={labelSearch}
            onChange={(event) => setLabelSearch(event.target.value)}
            placeholder={getI18nRuntime().i18n.t("entity:realm_wiki_zone_label_search_placeholder")}
          />
          <LabeledSelect
            label=""
            value={labelTarget}
            options={labelInsertTargets}
            onChange={setLabelTarget}
            getLabel={(option) =>
              option === "navigation"
                ? getI18nRuntime().i18n.t("entity:realm_wiki_zone_label_navigation")
                : getI18nRuntime().i18n.t("entity:realm_wiki_zone_label_homepage")
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
            placeholder={getI18nRuntime().i18n.t("entity:realm_wiki_zone_label_title_placeholder")}
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
          <Label>{getI18nRuntime().i18n.t("entity:realm_wiki_zone_navigation_json")}</Label>
          <Textarea
            value={navigationJson}
            onChange={(event) => setNavigationJson(event.target.value)}
            className="min-h-48 font-mono text-xs"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>{getI18nRuntime().i18n.t("entity:realm_wiki_zone_homepage_sections_json")}</Label>
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

function TagTreeEditor({
  realmId,
  initialValue,
}: {
  realmId: string;
  initialValue?: TagTreeNode[];
}) {
  const [nodes, setNodes] = useState<TagTreeNode[]>(initialValue ?? []);
  const [headerLabel, setHeaderLabel] = useState("");
  const [labelLanguage, setLabelLanguage] = useState<string>(DEFAULT_LANGUAGE);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(
    null,
  );
  const setValue = useSetRealmExtraValueMutation();
  const searchTerm = search.trim();
  const { data: searchData } = useQuery(tagQueries.search(searchTerm));
  const results = useMemo(() => {
    return ((searchData?.tags ?? []) as TagSearchResult[]).flatMap((tag) => {
      const tagId = tag.unitId ?? tag.tagUnitId;
      if (!tagId || nodes.some((node) => node.tagId === tagId)) return [];
      return [{ tagId, label: tag.label ?? tag.slug ?? tagId.slice(0, 8) }];
    });
  }, [nodes, searchData?.tags]);

  useEffect(() => {
    setNodes(initialValue ?? []);
  }, [initialValue]);

  const updateNode = (index: number, next: TagTreeNode) => {
    setNodes((current) =>
      current.map((node, nodeIndex) => (nodeIndex === index ? next : node)),
    );
  };

  const updateNodeLabelTranslation = (
    index: number,
    language: string,
    value: string,
  ) => {
    const normalized = normalizeLanguage(language) ?? DEFAULT_LANGUAGE;
    setNodes((current) =>
      current.map((node, nodeIndex) => {
        if (nodeIndex !== index) return node;
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
      }),
    );
  };

  const moveNode = (index: number, delta: -1 | 1) => {
    setNodes((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const save = async () => {
    setError(null);
    try {
      await setValue.mutateAsync({
        realmId,
        key: "tagTree",
        value: nodes,
      });
      toast.success(getI18nRuntime().i18n.t("entity:realm_tag_tree_saved"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(message);
      toast.error(message);
    }
  };

  const pendingDeleteNode =
    pendingDeleteIndex === null ? null : (nodes[pendingDeleteIndex] ?? null);
  const confirmDeleteNode = () => {
    if (pendingDeleteIndex === null) return;
    setNodes((current) =>
      current.filter((_, index) => index !== pendingDeleteIndex),
    );
    setPendingDeleteIndex(null);
  };

  return (
    <div className="flex flex-col gap-3 rounded-md bg-surface-subtle p-4">
      <div>
        <h3 className="text-sm font-medium leading-ui text-text-primary">
          {getI18nRuntime().i18n.t("entity:realm_tag_tree")}
        </h3>
        <p className="mt-1 text-sm leading-body text-text-secondary">
          {getI18nRuntime().i18n.t("entity:realm_tag_tree_description")}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="max-w-40">
          <Label htmlFor="realm-tag-tree-label-language">Label language</Label>
          <Input
            id="realm-tag-tree-label-language"
            value={labelLanguage}
            onChange={(event) => setLabelLanguage(event.target.value)}
          />
        </div>
        {nodes.map((node, index) => (
          <div
            key={nodeKey(node)}
            className="grid gap-2 rounded-sm bg-surface-base p-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto_auto_auto]"
          >
            <Input
              value={nodeLabel(node)}
              onChange={(event) =>
                updateNode(index, { ...node, label: event.target.value })
              }
              className="min-w-0"
            />
            <Input
              value={
                node.labelTranslations?.translations[
                  normalizeLanguage(labelLanguage) ?? DEFAULT_LANGUAGE
                ] ?? ""
              }
              onChange={(event) =>
                updateNodeLabelTranslation(
                  index,
                  labelLanguage,
                  event.target.value,
                )
              }
              className="min-w-0"
              placeholder={`Label (${normalizeLanguage(labelLanguage) ?? DEFAULT_LANGUAGE})`}
            />
            <Button
              type="button"
              size="sm"
              variant={node.disabled ? "secondary" : "outline"}
              onClick={() =>
                updateNode(index, { ...node, disabled: !node.disabled })
              }
            >
              {node.disabled ? getI18nRuntime().i18n.t("common:disabled") : getI18nRuntime().i18n.t("common:enabled")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => moveNode(index, -1)}
            >
              {getI18nRuntime().i18n.t("common:up")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => moveNode(index, 1)}
            >
              {getI18nRuntime().i18n.t("common:down")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => setPendingDeleteIndex(index)}
            >
              {getI18nRuntime().i18n.t("common:delete")}
            </Button>
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex gap-2">
          <Input
            value={headerLabel}
            onChange={(event) => setHeaderLabel(event.target.value)}
            placeholder={getI18nRuntime().i18n.t("entity:realm_header_label_placeholder")}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!headerLabel.trim()) return;
              setNodes((current) => [
                ...current,
                { disabled: true, label: headerLabel.trim() },
              ]);
              setHeaderLabel("");
            }}
          >
            {getI18nRuntime().i18n.t("entity:realm_add_header")}
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={getI18nRuntime().i18n.t("community:tag_search_placeholder")}
          />
          {searchTerm && results.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {results.map((tag) => (
                <Button
                  key={tag.tagId}
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setNodes((current) => [
                      ...current,
                      { tagId: tag.tagId, label: tag.label },
                    ])
                  }
                >
                  {tag.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        {error && (
          <p className="mr-auto text-sm leading-ui text-error-text">{error}</p>
        )}
        <Button onClick={save} disabled={setValue.isPending}>
          {getI18nRuntime().i18n.t("entity:realm_save_tag_tree")}
        </Button>
      </div>

      <Dialog
        open={pendingDeleteIndex !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteIndex(null);
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
            <Button variant="ghost" onClick={() => setPendingDeleteIndex(null)}>
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

function SlotPicker({
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
  const searchTerm = search.trim();
  const { data } = useQuery(
    unitQueries.search(searchTerm, { type: "POST", limit: 8 }),
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
        slotKey === "rule" ? getI18nRuntime().i18n.t("entity:realm_rule_saved") : getI18nRuntime().i18n.t("entity:realm_about_saved"),
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
        {slotKey === "rule" ? getI18nRuntime().i18n.t("entity:realm_rule_post") : getI18nRuntime().i18n.t("entity:realm_about_post")}
      </Label>
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={getI18nRuntime().i18n.t("community:post_search_placeholder")}
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

function BannerPicker({
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
  const searchTerm = search.trim();
  const { data } = useQuery(
    unitQueries.search(searchTerm, { type: "POST", limit: 8 }),
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
        placeholder={getI18nRuntime().i18n.t("entity:realm_direct_image_url_placeholder")}
      />
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={getI18nRuntime().i18n.t("community:post_search_placeholder")}
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
          {getI18nRuntime().i18n.t("entity:realm_selected_post", { id: postId })}
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
