import {
  useClearRealmExtraValueMutation,
  useSetRealmExtraValueMutation,
} from "@rezics/api/realm/realm-extra.mutations";
import { tagApi } from "@rezics/api/tag/tag";
import { unitApi, unitQueries } from "@rezics/api/unit/unit";
import { unitDetailQuery } from "@rezics/api/unit/unit.queries";
import { zonePortalQueryOptions } from "@rezics/api/zone/zone";
import type {
  RealmAvatarExtra,
  RealmBannerExtra,
  RealmTagView,
  RealmTagViewStyle,
  RealmWikiSidebar,
  TagTreeNode,
  UnitDTO,
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
} from "@rezics/ui/shadcn";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ListTree,
  Plus,
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
  emptyTreeEditOpLog,
  enqueueTreeEditOp,
  ensureTreeChildren,
  type TreeActionItem,
  type TreeEditOpLog,
  TreeEditorFooter,
  TreeEditorRow,
  TreeMoveToDialog,
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

const TREE_DROP_INDENT = 32;

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
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
      toast.success(getI18nRuntime().i18n.t("community:tag_view_saved"));
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
          <Label htmlFor="realm-tag-view-style">{getI18nRuntime().i18n.t("community:tag_view_default")}</Label>
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
              <SelectItem value="flat">{getI18nRuntime().i18n.t("community:tag_view_flat")}</SelectItem>
              <SelectItem value="grouped">{getI18nRuntime().i18n.t("community:tag_view_grouped")}</SelectItem>
              <SelectItem value="tree">{getI18nRuntime().i18n.t("community:tag_view_tree")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant={allowViewerSwitch ? "secondary" : "outline"}
          onClick={() => setAllowViewerSwitch((value) => !value)}
        >
          {allowViewerSwitch ? getI18nRuntime().i18n.t("community:tag_view_viewer_switch_on") : getI18nRuntime().i18n.t("community:tag_view_viewer_switch_off")}
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

export function FeaturedZonePicker({
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
  const zoneQuery = useQuery(zonePortalQueryOptions(trimmedZoneId, "home"));
  const zone = zoneQuery.data?.zone;

  useEffect(() => {
    setZoneId(value ?? "");
  }, [value]);

  const save = async () => {
    setError(null);
    try {
      if (trimmedZoneId) {
        await setValue.mutateAsync({
          realmId,
          key: "featuredZoneUnitId",
          value: trimmedZoneId,
        });
      } else {
        await clearValue.mutateAsync({ realmId, key: "featuredZoneUnitId" });
      }
      toast.success(
        getI18nRuntime().i18n.t("entity:realm_featured_zone_saved"),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(message);
      toast.error(message);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-md bg-surface-subtle p-4">
      <div>
        <Label>{getI18nRuntime().i18n.t("entity:realm_featured_zone")}</Label>
        <p className="mt-1 text-sm leading-body text-text-secondary">
          {getI18nRuntime().i18n.t("entity:realm_featured_zone_description")}
        </p>
      </div>
      <Input
        value={zoneId}
        onChange={(event) => setZoneId(event.target.value)}
        placeholder={getI18nRuntime().i18n.t(
          "entity:realm_zone_unit_id_placeholder",
        )}
      />
      {trimmedZoneId && (
        <div className="rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm leading-ui">
          {zone ? (
            <div className="flex flex-col gap-1">
              <span className="font-medium text-text-primary">
                {zone.name || zone.slug}
              </span>
              <span className="text-text-secondary">
                {getI18nRuntime().i18n.t("common:selected_id", {
                  id: trimmedZoneId,
                })}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-text-secondary">
                {getI18nRuntime().i18n.t("common:selected_id", {
                  id: trimmedZoneId,
                })}
              </span>
              {!zoneQuery.isLoading ? (
                <span className="text-error-text">
                  {getI18nRuntime().i18n.t("entity:realm_zone_unresolved")}
                </span>
              ) : null}
            </div>
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
    </div>
  );
}

export function WikiSidebarPicker({
  realmId,
  value,
}: {
  realmId: string;
  value?: RealmWikiSidebar | null;
}) {
  const [kind, setKind] = useState<"auto" | RealmWikiSidebar["kind"]>(
    value?.kind ?? "auto",
  );
  const [postUnitId, setPostUnitId] = useState(
    value?.kind === "post" ? value.postUnitId : "",
  );
  const [zoneUnitId, setZoneUnitId] = useState(
    value?.kind === "zoneNav" ? value.zoneUnitId : "",
  );
  const [menuId, setMenuId] = useState(
    value?.kind === "zoneNav" ? (value.menuId ?? "") : "",
  );
  const [error, setError] = useState<string | null>(null);
  const readContext = useReadLanguageContext();
  const setValue = useSetRealmExtraValueMutation();
  const clearValue = useClearRealmExtraValueMutation();
  const trimmedPostUnitId = postUnitId.trim();
  const trimmedZoneUnitId = zoneUnitId.trim();
  const trimmedMenuId = menuId.trim();
  const postQuery = useQuery({
    ...unitDetailQuery(trimmedPostUnitId, {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
      languageMode: readContext.languageMode,
    }),
    enabled: readContext.ready && kind === "post" && Boolean(trimmedPostUnitId),
  });
  const zoneQuery = useQuery({
    ...zonePortalQueryOptions(trimmedZoneUnitId, "home", readContext.languages),
    enabled:
      readContext.ready && kind === "zoneNav" && Boolean(trimmedZoneUnitId),
  });

  useEffect(() => {
    setKind(value?.kind ?? "auto");
    setPostUnitId(value?.kind === "post" ? value.postUnitId : "");
    setZoneUnitId(value?.kind === "zoneNav" ? value.zoneUnitId : "");
    setMenuId(value?.kind === "zoneNav" ? (value.menuId ?? "") : "");
  }, [value]);

  const save = async () => {
    setError(null);
    try {
      if (kind === "auto") {
        await clearValue.mutateAsync({ realmId, key: "wikiSidebar" });
      } else if (kind === "post") {
        if (!trimmedPostUnitId) throw new Error("Post Unit ID is required.");
        await setValue.mutateAsync({
          realmId,
          key: "wikiSidebar",
          value: { kind: "post", postUnitId: trimmedPostUnitId },
        });
      } else {
        if (!trimmedZoneUnitId) throw new Error("Zone Unit ID is required.");
        await setValue.mutateAsync({
          realmId,
          key: "wikiSidebar",
          value: {
            kind: "zoneNav",
            zoneUnitId: trimmedZoneUnitId,
            ...(trimmedMenuId ? { menuId: trimmedMenuId } : {}),
          },
        });
      }
      toast.success(getI18nRuntime().i18n.t("entity:realm_wiki_sidebar_saved"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(message);
      toast.error(message);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-md bg-surface-subtle p-4">
      <div>
        <Label htmlFor="realm-wiki-sidebar-kind">
          {getI18nRuntime().i18n.t("entity:realm_wiki_sidebar")}
        </Label>
        <p className="mt-1 text-sm leading-body text-text-secondary">
          {getI18nRuntime().i18n.t("entity:realm_wiki_sidebar_description")}
        </p>
      </div>
      <Select
        value={kind}
        onValueChange={(next) =>
          setKind(next as "auto" | RealmWikiSidebar["kind"])
        }
      >
        <SelectTrigger id="realm-wiki-sidebar-kind">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">
            {getI18nRuntime().i18n.t("entity:realm_wiki_sidebar_auto")}
          </SelectItem>
          <SelectItem value="post">
            {getI18nRuntime().i18n.t("entity:realm_wiki_sidebar_post")}
          </SelectItem>
          <SelectItem value="zoneNav">
            {getI18nRuntime().i18n.t("entity:realm_wiki_sidebar_zone_nav")}
          </SelectItem>
        </SelectContent>
      </Select>

      {kind === "post" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="realm-wiki-sidebar-post">
            {getI18nRuntime().i18n.t("entity:realm_wiki_sidebar_post_unit_id")}
          </Label>
          <Input
            id="realm-wiki-sidebar-post"
            value={postUnitId}
            onChange={(event) => setPostUnitId(event.target.value)}
            placeholder={getI18nRuntime().i18n.t("common:unit_id")}
          />
          <ResolutionPreview
            id={trimmedPostUnitId}
            title={postQuery.data ? unitLabel(postQuery.data) : null}
            loading={postQuery.isLoading}
          />
        </div>
      ) : null}

      {kind === "zoneNav" ? (
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
          <div className="flex flex-col gap-2">
            <Label htmlFor="realm-wiki-sidebar-zone">
              {getI18nRuntime().i18n.t(
                "entity:realm_wiki_sidebar_zone_unit_id",
              )}
            </Label>
            <Input
              id="realm-wiki-sidebar-zone"
              value={zoneUnitId}
              onChange={(event) => setZoneUnitId(event.target.value)}
              placeholder={getI18nRuntime().i18n.t(
                "entity:realm_zone_unit_id_placeholder",
              )}
            />
            <ResolutionPreview
              id={trimmedZoneUnitId}
              title={
                zoneQuery.data?.zone
                  ? zoneQuery.data.zone.name || zoneQuery.data.zone.slug
                  : null
              }
              loading={zoneQuery.isLoading}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="realm-wiki-sidebar-menu">
              {getI18nRuntime().i18n.t("entity:realm_wiki_sidebar_menu_id")}
            </Label>
            <Input
              id="realm-wiki-sidebar-menu"
              value={menuId}
              onChange={(event) => setMenuId(event.target.value)}
              placeholder="header"
            />
          </div>
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        {error && (
          <p className="mr-auto text-sm leading-ui text-error-text">{error}</p>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setKind("auto");
            setPostUnitId("");
            setZoneUnitId("");
            setMenuId("");
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

function ResolutionPreview({
  id,
  title,
  loading,
}: {
  id: string;
  title: string | null;
  loading: boolean;
}) {
  if (!id) return null;
  return (
    <div className="rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm leading-ui">
      {title ? (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-text-primary">{title}</span>
          <span className="text-text-secondary">
            {getI18nRuntime().i18n.t("common:selected_id", { id })}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <span className="text-text-secondary">
            {getI18nRuntime().i18n.t("common:selected_id", { id })}
          </span>
          {!loading ? (
            <span className="text-error-text">
              {getI18nRuntime().i18n.t("entity:realm_reference_unresolved")}
            </span>
          ) : null}
        </div>
      )}
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
      ? getI18nRuntime().i18n.t("community:tag_tree_type_tag")
      : node.data.labelUnitId
        ? getI18nRuntime().i18n.t("community:tag_tree_type_label")
        : getI18nRuntime().i18n.t("community:tag_tree_type_local");
    const actionItems: TreeActionItem[] = [
      {
        key: "addSiblingAfter",
        label: getI18nRuntime().i18n.t("community:tag_tree_add_sibling"),
        icon: <Plus className="size-4" aria-hidden />,
        onSelect: () =>
          openAddDialog({ kind: "siblingAfter", nodeId: node.data.id }),
      },
      {
        key: "addChild",
        label: getI18nRuntime().i18n.t("community:tag_tree_add_child"),
        icon: <ListTree className="size-4" aria-hidden />,
        onSelect: () => openAddDialog({ kind: "child", nodeId: node.data.id }),
      },
      {
        key: "moveTo",
        label: getI18nRuntime().i18n.t("community:tag_tree_move_to"),
        separatorBefore: true,
        onSelect: () => setMoveToNodeId(node.data.id),
      },
      {
        key: "indent",
        label: getI18nRuntime().i18n.t("community:tag_tree_indent"),
        icon: <ChevronRight className="size-4" aria-hidden />,
        onSelect: () => moveDepth(node.data.id, "indent"),
      },
      {
        key: "outdent",
        label: getI18nRuntime().i18n.t("community:tag_tree_outdent"),
        icon: <ChevronLeft className="size-4" aria-hidden />,
        onSelect: () => moveDepth(node.data.id, "outdent"),
      },
      {
        key: "moveToFirst",
        label: getI18nRuntime().i18n.t("community:tag_tree_move_first"),
        onSelect: () => moveSiblingToEdge(node.data.id, "first"),
      },
      {
        key: "moveToLast",
        label: getI18nRuntime().i18n.t("community:tag_tree_move_last"),
        onSelect: () => moveSiblingToEdge(node.data.id, "last"),
      },
      {
        key: "delete",
        label: getI18nRuntime().i18n.t("common:delete"),
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
          <Label htmlFor="realm-tag-tree-label-language">{getI18nRuntime().i18n.t("community:tag_tree_label_language")}</Label>
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
            <DialogTitle>{getI18nRuntime().i18n.t("community:tag_tree_add_title")}</DialogTitle>
            <DialogDescription>
              Search existing labels or tags first. Create a new item only when
              the catalog does not already have the term you need.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="realm-tag-tree-add-search">{getI18nRuntime().i18n.t("common:search")}</Label>
              <Input
                id="realm-tag-tree-add-search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setCreateTitle(event.target.value);
                }}
                placeholder={getI18nRuntime().i18n.t("community:tag_tree_search_placeholder")}
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
                placeholder={getI18nRuntime().i18n.t("community:tag_tree_name_placeholder")}
              />
              <div className="grid gap-2 sm:grid-cols-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!createTitle.trim()}
                  onClick={() => void createPublicLabel()}
                >
                  {getI18nRuntime().i18n.t("community:tag_tree_create_public_label")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!createTitle.trim()}
                  onClick={() => void createPublicTag()}
                >
                  {getI18nRuntime().i18n.t("community:tag_tree_create_tag")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!createTitle.trim()}
                  onClick={createLocalHeading}
                >
                  {getI18nRuntime().i18n.t("community:tag_tree_use_local_heading")}
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
            <DialogTitle>{getI18nRuntime().i18n.t("community:tag_tree_delete_title")}</DialogTitle>
            <DialogDescription>
              {getI18nRuntime().i18n.t("community:tag_tree_delete_description")}
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
      toast.success(getI18nRuntime().i18n.t("community:translations_saved"));
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
