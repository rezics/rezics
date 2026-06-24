import { labelListQuery } from "@rezics/contract/api/label/label";
import {
  meiliLabelSearchQueryOptions,
  meiliTagSearchQueryOptions,
} from "@rezics/contract/api/meili/meili.queries";
import {
  realmTagTreeQuery,
  useUpdateRealmTagTreeMutation,
} from "@rezics/contract/api/realm-tag-tree";
import { tagBatchTranslationsQuery } from "@rezics/contract/api/tag/tag";
import type {
  LabelSearchDocument,
  RealmTagTree,
  RealmTagTreeNode,
  RealmTagViewMode,
  TagSearchDocument,
} from "@rezics/contract";
import { emptyRealmTagTree } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Badge,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDebouncedValue } from "@/entity-picker";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { cn } from "@/shared/utils/css-util";
import {
  buildRealmTagTreeDisplayNames,
  collectRealmTagTreeUnitIds,
  realmTagTreeNodeDisplayLabel,
  type RealmTagTreeDisplayNames,
} from "../models/realmTagTreeHydration";

type EditorNode = RealmTagTreeNode & {
  clientId: string;
  children?: EditorNode[];
};

function makeClientId() {
  return crypto.randomUUID();
}

function toEditorNodes(nodes: readonly RealmTagTreeNode[]): EditorNode[] {
  return nodes.map((node) => ({
    ...node,
    clientId: makeClientId(),
    children: node.children?.length ? toEditorNodes(node.children) : [],
  }));
}

function toRealmNodes(nodes: readonly EditorNode[]): RealmTagTreeNode[] {
  return nodes.map(({ clientId: _clientId, children, ...node }) => ({
    ...node,
    children: children?.length ? toRealmNodes(children) : undefined,
  }));
}

function findNode(
  nodes: readonly EditorNode[],
  clientId: string | null,
): EditorNode | null {
  if (!clientId) return null;
  for (const node of nodes) {
    if (node.clientId === clientId) return node;
    const child = findNode(node.children ?? [], clientId);
    if (child) return child;
  }
  return null;
}

function mapTree(
  nodes: EditorNode[],
  fn: (nodes: EditorNode[]) => EditorNode[],
): EditorNode[] {
  return fn(nodes).map((node) => ({
    ...node,
    children: node.children?.length
      ? mapTree(node.children, fn)
      : node.children,
  }));
}

function insertChild(
  nodes: EditorNode[],
  parentId: string | null,
  child: EditorNode,
): EditorNode[] {
  if (!parentId) return [...nodes, child];
  return nodes.map((node) =>
    node.clientId === parentId
      ? { ...node, children: [...(node.children ?? []), child] }
      : {
          ...node,
          children: node.children
            ? insertChild(node.children, parentId, child)
            : node.children,
        },
  );
}

function removeNode(nodes: EditorNode[], clientId: string): EditorNode[] {
  return nodes
    .filter((node) => node.clientId !== clientId)
    .map((node) => ({
      ...node,
      children: node.children
        ? removeNode(node.children, clientId)
        : node.children,
    }));
}

function moveSibling(
  nodes: EditorNode[],
  clientId: string,
  delta: -1 | 1,
): EditorNode[] {
  const index = nodes.findIndex((node) => node.clientId === clientId);
  if (index >= 0) {
    const target = index + delta;
    if (target < 0 || target >= nodes.length) return nodes;
    const next = [...nodes];
    const [node] = next.splice(index, 1);
    if (node) next.splice(target, 0, node);
    return next;
  }
  return nodes.map((node) => ({
    ...node,
    children: node.children
      ? moveSibling(node.children, clientId, delta)
      : node.children,
  }));
}

function indentNode(nodes: EditorNode[], clientId: string): EditorNode[] {
  const index = nodes.findIndex((node) => node.clientId === clientId);
  if (index > 0) {
    const next = [...nodes];
    const [node] = next.splice(index, 1);
    const previous = next[index - 1];
    if (node && previous)
      previous.children = [...(previous.children ?? []), node];
    return next;
  }
  return nodes.map((node) => ({
    ...node,
    children: node.children
      ? indentNode(node.children, clientId)
      : node.children,
  }));
}

function labelSearchLabel(item: LabelSearchDocument | TagSearchDocument) {
  return item.title ?? item.id;
}

/**
 * 设计：realm tag tree 管理器是工作型面板，不使用 JSON 编辑。
 * Mobile: 单列，toolbar/search/tree 垂直堆叠，row actions 换行。
 * Tablet: 保持单列但 row action 靠右。
 * Desktop: 在父级最大宽内显示紧凑树，搜索结果两列。
 * Ultra-wide: 不扩展到全屏，继承管理页约束。
 */
export function RealmTagTreeEditor({ realmId }: { realmId: string }) {
  const { t } = useTranslation(["common", "community", "entity"]);
  const readContext = useReadLanguageContext();
  const treeQuery = useQuery(realmTagTreeQuery(realmId));
  const updateTree = useUpdateRealmTagTreeMutation(realmId);
  const sourceTree = treeQuery.data?.tree ?? emptyRealmTagTree();
  const [nodes, setNodes] = useState<EditorNode[]>(() =>
    toEditorNodes(sourceTree.nodes),
  );
  const [defaultMode, setDefaultMode] = useState<RealmTagViewMode>(
    sourceTree.view.defaultMode,
  );
  const [allowViewerSwitch, setAllowViewerSwitch] = useState(
    sourceTree.view.allowViewerSwitch,
  );
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 180);
  const hydratedTree = useMemo<RealmTagTree>(
    () => ({
      schema: "rezics/realm-tag-tree",
      version: 1,
      view: { defaultMode, allowViewerSwitch },
      nodes: toRealmNodes(nodes),
    }),
    [allowViewerSwitch, defaultMode, nodes],
  );
  const refs = useMemo(
    () => collectRealmTagTreeUnitIds(hydratedTree),
    [hydratedTree],
  );
  const { data: tagTranslations } = useQuery(
    tagBatchTranslationsQuery(refs.tagUnitIds, readContext.appLocale),
  );
  const { data: labels } = useQuery(labelListQuery(refs.labelUnitIds));
  const displayNames = useMemo(
    () =>
      buildRealmTagTreeDisplayNames({
        tagTranslations,
        labels: labels?.labels,
        language: readContext.appLocale,
      }),
    [labels?.labels, readContext.appLocale, tagTranslations],
  );
  const labelSearch = useQuery({
    ...meiliLabelSearchQueryOptions({
      keyword: debouncedQuery,
      languages: readContext.languages,
      appLocale: readContext.appLocale,
      limit: 8,
    }),
    enabled: readContext.ready && debouncedQuery.length > 0,
  });
  const tagSearch = useQuery({
    ...meiliTagSearchQueryOptions({
      keyword: debouncedQuery,
      languages: readContext.languages,
      appLocale: readContext.appLocale,
      limit: 8,
    }),
    enabled: readContext.ready && debouncedQuery.length > 0,
  });

  useEffect(() => {
    setNodes(toEditorNodes(sourceTree.nodes));
    setDefaultMode(sourceTree.view.defaultMode);
    setAllowViewerSwitch(sourceTree.view.allowViewerSwitch);
  }, [sourceTree]);

  const selectedParent = findNode(nodes, selectedParentId);
  const addNode = (node: RealmTagTreeNode) => {
    setNodes((current) =>
      insertChild(current, selectedParentId, {
        ...node,
        clientId: makeClientId(),
        children: [],
      }),
    );
    setQuery("");
  };
  const save = async () => {
    await updateTree.mutateAsync({ tree: hydratedTree });
  };

  return (
    <section className="flex min-h-0 flex-col gap-4 rounded-md bg-surface-subtle p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 text-sm font-medium leading-ui text-text-primary">
            {t("entity:realm_tag_tree")}
          </h3>
          <p className="m-0 mt-1 text-sm leading-body text-text-secondary">
            {t("entity:realm_tag_tree_description")}
          </p>
        </div>
        {treeQuery.isFetching ? <Spinner size="sm" /> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
        <div className="flex flex-col gap-1">
          <Label htmlFor="realm-tag-tree-mode">
            {t("community:tag_view_default")}
          </Label>
          <Select
            value={defaultMode}
            onValueChange={(value) => setDefaultMode(value as RealmTagViewMode)}
          >
            <SelectTrigger id="realm-tag-tree-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="flat">
                {t("community:tag_view_flat")}
              </SelectItem>
              <SelectItem value="grouped">
                {t("community:tag_view_grouped")}
              </SelectItem>
              <SelectItem value="tree">
                {t("community:tag_view_tree")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setAllowViewerSwitch((value) => !value)}
        >
          {allowViewerSwitch
            ? t("community:tag_view_viewer_switch_on")
            : t("community:tag_view_viewer_switch_off")}
        </Button>
        <Button type="button" onClick={save} disabled={updateTree.isPending}>
          {t("common:save")}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-h-0 rounded-sm bg-surface-base p-3">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={selectedParentId === null ? "default" : "secondary"}
              onClick={() => setSelectedParentId(null)}
            >
              <Plus className="size-4" aria-hidden />
              {t("common:add")}
            </Button>
            {selectedParent ? (
              <Badge variant="secondary">
                {realmTagTreeNodeDisplayLabel(selectedParent, displayNames)}
              </Badge>
            ) : null}
          </div>
          <div className="max-h-[28rem] overflow-y-auto pr-1">
            {nodes.length === 0 ? (
              <p className="m-0 text-sm leading-body text-text-secondary">
                {t("community:tag_empty")}
              </p>
            ) : (
              <TreeRows
                nodes={nodes}
                displayNames={displayNames}
                policyLabel={t("community:realm_tag_tree_policy_source")}
                selectedParentId={selectedParentId}
                onSelectParent={setSelectedParentId}
                onMove={(id, delta) =>
                  setNodes((current) => moveSibling(current, id, delta))
                }
                onIndent={(id) =>
                  setNodes((current) => indentNode(current, id))
                }
                onDelete={(id) =>
                  setNodes((current) => removeNode(current, id))
                }
                onTogglePolicy={(id) =>
                  setNodes((current) =>
                    mapTree(current, (items) =>
                      items.map((item) =>
                        item.clientId === id && item.kind === "tag"
                          ? {
                              ...item,
                              querySource:
                                item.querySource === "policy"
                                  ? undefined
                                  : "policy",
                            }
                          : item,
                      ),
                    ),
                  )
                }
              />
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-3 rounded-sm bg-surface-base p-3">
          <div className="relative">
            <Search
              className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-text-tertiary"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
              placeholder={t("community:policy_tag_pick_tag_search")}
            />
          </div>
          <SearchResults
            title={t("entity:realm_tag_tree")}
            labels={labelSearch.data?.items ?? []}
            tags={tagSearch.data?.items ?? []}
            onAddLabel={(label) =>
              addNode({ kind: "label", labelUnitId: label.id })
            }
            onAddTag={(tag) => addNode({ kind: "tag", tagUnitId: tag.id })}
          />
        </div>
      </div>
    </section>
  );
}

function TreeRows(props: {
  nodes: EditorNode[];
  displayNames: RealmTagTreeDisplayNames;
  policyLabel: string;
  selectedParentId: string | null;
  onSelectParent: (id: string) => void;
  onMove: (id: string, delta: -1 | 1) => void;
  onIndent: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePolicy: (id: string) => void;
  depth?: number;
}) {
  const depth = props.depth ?? 0;
  return (
    <div className="flex flex-col gap-1">
      {props.nodes.map((node) => (
        <div key={node.clientId} className="flex flex-col gap-1">
          <div
            className={cn(
              "flex flex-wrap items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
              props.selectedParentId === node.clientId
                ? "bg-accent-subtle"
                : "bg-surface-subtle",
            )}
            style={{ marginInlineStart: `${depth * 1.25}rem` }}
          >
            <Badge variant={node.kind === "tag" ? "default" : "secondary"}>
              {node.kind}
            </Badge>
            <span className="min-w-0 flex-1 truncate">
              {realmTagTreeNodeDisplayLabel(node, props.displayNames)}
            </span>
            {node.kind === "tag" ? (
              <Button
                type="button"
                size="sm"
                variant={
                  node.querySource === "policy" ? "default" : "secondary"
                }
                onClick={() => props.onTogglePolicy(node.clientId)}
              >
                {props.policyLabel}
              </Button>
            ) : null}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => props.onSelectParent(node.clientId)}
            >
              <Plus className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => props.onMove(node.clientId, -1)}
            >
              <ArrowUp className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => props.onMove(node.clientId, 1)}
            >
              <ArrowDown className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => props.onIndent(node.clientId)}
            >
              <ArrowRight className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => props.onDelete(node.clientId)}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
          {node.children?.length ? (
            <TreeRows {...props} nodes={node.children} depth={depth + 1} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function SearchResults({
  labels,
  tags,
  onAddLabel,
  onAddTag,
}: {
  title: string;
  labels: LabelSearchDocument[];
  tags: TagSearchDocument[];
  onAddLabel: (label: LabelSearchDocument) => void;
  onAddTag: (tag: TagSearchDocument) => void;
}) {
  return (
    <div className="grid min-h-0 gap-3">
      <div className="flex min-h-0 flex-col gap-1">
        {labels.map((label) => (
          <Button
            key={label.id}
            type="button"
            variant="ghost"
            className="h-auto justify-start px-2 py-2"
            onClick={() => onAddLabel(label)}
          >
            <span className="truncate">{labelSearchLabel(label)}</span>
          </Button>
        ))}
      </div>
      <div className="flex min-h-0 flex-col gap-1">
        {tags.map((tag) => (
          <Button
            key={tag.id}
            type="button"
            variant="ghost"
            className="h-auto justify-start px-2 py-2"
            onClick={() => onAddTag(tag)}
          >
            <span className="truncate">{labelSearchLabel(tag)}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
