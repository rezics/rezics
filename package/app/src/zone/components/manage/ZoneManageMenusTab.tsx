import type { ZoneMenu, ZoneMenuNode } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import {
  Button,
  Card,
  CardContent,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import {
  CornerDownRight,
  IndentDecrease,
  IndentIncrease,
  Plus,
} from "lucide-react";
import type { ZoneManageDraft } from "../../models/zoneManageDraft";
import {
  canAddZoneMenuChild,
  indentZoneMenuNodeAtPath,
  insertZoneMenuNode,
  moveZoneMenuNodeAtPath,
  nextZoneId,
  outdentZoneMenuNodeAtPath,
  removeZoneMenuAtIndex,
  removeZoneMenuNodeAtPath,
  updateZoneMenuAtIndex,
  updateZoneMenuNodeAtPath,
  type ZoneMenuNodePath,
} from "../../models/zoneManageDraft";
import type { ZoneRefUnitMap } from "../../models/zoneMenu";
import { ZoneLabelField } from "./ZoneLabelField";
import {
  ZoneLinkTargetField,
  type ZoneLinkTargetPageOption,
} from "./ZoneLinkTargetField";
import { ManageField, RowActions } from "./ZoneManageFields";

/**
 * Menus tab: menu list with per-menu node trees. Tree restructuring is
 * path-based (`models/zoneManageDraft.ts`, adapted from the tree-edit
 * feature's operations): reorder among siblings, indent into the previous
 * sibling, outdent to the parent level, add child — all guarded at
 * `ZONE_MENU_MAX_DEPTH`.
 * 菜单标签页：菜单列表加每个菜单的节点树。树结构调整基于路径
 * （`models/zoneManageDraft.ts`，改编自 tree-edit feature 的操作）：
 * 同级重排、缩进到前一个同级、提升到父级层、新增子节点——全部受
 * `ZONE_MENU_MAX_DEPTH` 守卫。
 */
export function ZoneManageMenusTab({
  draft,
  onDraftChange,
  refUnits,
  pages,
  defaultPageId,
}: {
  draft: ZoneManageDraft;
  onDraftChange: (draft: ZoneManageDraft) => void;
  refUnits: ZoneRefUnitMap;
  pages: readonly ZoneLinkTargetPageOption[];
  defaultPageId: string | null;
}) {
  const { t } = useTranslation(["zone", "common"]);
  const fallbackPageId = defaultPageId ?? "home";

  const updateMenu = (index: number, menu: ZoneMenu) => {
    onDraftChange(updateZoneMenuAtIndex(draft, index, menu));
  };

  const removeMenu = (index: number) => {
    onDraftChange(removeZoneMenuAtIndex(draft, index));
  };

  return (
    <div className="flex flex-col gap-4">
      <Card surface="contained">
        <CardContent className="p-4">
          <ManageField label={t("zone:manage_header_menu")}>
            <Select
              value={draft.header.menuSlug}
              onValueChange={(menuSlug) =>
                onDraftChange({
                  ...draft,
                  header: { ...draft.header, menuSlug },
                })
              }
            >
              <SelectTrigger className="w-56 font-mono text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {draft.menus.map((menu) => (
                  <SelectItem
                    key={menu.slug}
                    value={menu.slug}
                    className="font-mono"
                  >
                    {menu.slug}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ManageField>
        </CardContent>
      </Card>

      {draft.menus.map((menu, index) => (
        <Card
          // biome-ignore lint/suspicious/noArrayIndexKey: menu ids are editable; index keeps the card mounted while the id input changes.
          key={index}
          surface="contained"
        >
          <CardContent className="flex flex-col gap-4 p-4">
            <div className="flex items-end justify-between gap-3">
              <ManageField label={t("zone:manage_menu_slug")}>
                <Input
                  value={menu.slug}
                  className="w-56 font-mono text-sm"
                  onChange={(event) =>
                    updateMenu(index, { ...menu, slug: event.target.value })
                  }
                />
              </ManageField>
              <RowActions onRemove={() => removeMenu(index)} />
            </div>

            <ZoneMenuNodeList
              nodes={menu.nodes}
              parentPath={[]}
              rootNodes={menu.nodes}
              onNodesChange={(nodes) => updateMenu(index, { ...menu, nodes })}
              refUnits={refUnits}
              zonePages={pages}
              defaultPageId={fallbackPageId}
            />

            <p className="text-xs leading-dense text-text-tertiary">
              {t("zone:manage_depth_limit")}
            </p>
          </CardContent>
        </Card>
      ))}

      <div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            onDraftChange({
              ...draft,
              menus: [
                ...draft.menus,
                {
                  slug: nextZoneId(
                    "menu",
                    draft.menus.map((menu) => menu.slug),
                  ),
                  nodes: [],
                },
              ],
            })
          }
        >
          <Plus className="mr-1 size-4" aria-hidden />
          {t("zone:manage_add_menu")}
        </Button>
      </div>
    </div>
  );
}

function ZoneMenuNodeList({
  nodes,
  parentPath,
  rootNodes,
  onNodesChange,
  refUnits,
  zonePages,
  defaultPageId,
}: {
  nodes: readonly ZoneMenuNode[];
  parentPath: ZoneMenuNodePath;
  rootNodes: readonly ZoneMenuNode[];
  onNodesChange: (nodes: ZoneMenuNode[]) => void;
  refUnits: ZoneRefUnitMap;
  zonePages: readonly ZoneLinkTargetPageOption[];
  defaultPageId: string;
}) {
  const { t } = useTranslation(["zone", "common"]);

  const addNode = () => {
    const inserted = insertZoneMenuNode(rootNodes, parentPath, {
      target: { kind: "zonePage", pageId: defaultPageId },
    });
    if (inserted) onNodesChange(inserted);
  };

  return (
    <div
      className={
        parentPath.length > 0
          ? "flex flex-col gap-3 border-l border-border-whisper pl-4"
          : "flex flex-col gap-3"
      }
    >
      {nodes.map((node, index) => (
        <ZoneMenuNodeEditor
          key={[...parentPath, index].join(".")}
          node={node}
          path={[...parentPath, index]}
          siblingCount={nodes.length}
          rootNodes={rootNodes}
          onNodesChange={onNodesChange}
          refUnits={refUnits}
          zonePages={zonePages}
          defaultPageId={defaultPageId}
        />
      ))}
      <div>
        <Button type="button" size="sm" variant="ghost" onClick={addNode}>
          {parentPath.length > 0 ? (
            <CornerDownRight className="mr-1 size-4" aria-hidden />
          ) : (
            <Plus className="mr-1 size-4" aria-hidden />
          )}
          {parentPath.length > 0
            ? t("zone:manage_add_child")
            : t("zone:manage_add_node")}
        </Button>
      </div>
    </div>
  );
}

function ZoneMenuNodeEditor({
  node,
  path,
  siblingCount,
  rootNodes,
  onNodesChange,
  refUnits,
  zonePages,
  defaultPageId,
}: {
  node: ZoneMenuNode;
  path: ZoneMenuNodePath;
  siblingCount: number;
  rootNodes: readonly ZoneMenuNode[];
  onNodesChange: (nodes: ZoneMenuNode[]) => void;
  refUnits: ZoneRefUnitMap;
  zonePages: readonly ZoneLinkTargetPageOption[];
  defaultPageId: string;
}) {
  const { t } = useTranslation(["zone", "common"]);
  const index = path[path.length - 1] as number;

  const apply = (result: ZoneMenuNode[] | null) => {
    if (result) onNodesChange(result);
  };

  return (
    <div className="flex flex-col gap-3 rounded-md bg-surface-subtle p-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 text-sm font-medium leading-ui text-text-primary">
          {t("zone:manage_menu_node")}
        </div>
        <RowActions
          onMoveUp={
            index > 0
              ? () =>
                  onNodesChange(moveZoneMenuNodeAtPath(rootNodes, path, "up"))
              : undefined
          }
          onMoveDown={
            index < siblingCount - 1
              ? () =>
                  onNodesChange(moveZoneMenuNodeAtPath(rootNodes, path, "down"))
              : undefined
          }
          onRemove={() =>
            onNodesChange(removeZoneMenuNodeAtPath(rootNodes, path))
          }
        >
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={t("zone:manage_node_indent")}
            disabled={index === 0}
            onClick={() => apply(indentZoneMenuNodeAtPath(rootNodes, path))}
          >
            <IndentIncrease className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={t("zone:manage_node_outdent")}
            disabled={path.length < 2}
            onClick={() => apply(outdentZoneMenuNodeAtPath(rootNodes, path))}
          >
            <IndentDecrease className="size-4" aria-hidden />
          </Button>
        </RowActions>
      </div>

      <ZoneLabelField
        label={t("zone:manage_node_label")}
        value={node.labelUnitId}
        onChange={(labelUnitId) =>
          onNodesChange(
            updateZoneMenuNodeAtPath(rootNodes, path, (current) => {
              const next = { ...current };
              if (labelUnitId) next.labelUnitId = labelUnitId;
              else delete next.labelUnitId;
              return next;
            }),
          )
        }
        refUnits={refUnits}
      />

      <ZoneLinkTargetField
        value={node.target}
        onChange={(target) =>
          onNodesChange(
            updateZoneMenuNodeAtPath(rootNodes, path, (current) => {
              const next = { ...current };
              if (target) next.target = target;
              else delete next.target;
              return next;
            }),
          )
        }
        refUnits={refUnits}
        zonePages={zonePages}
        defaultPageId={defaultPageId}
        allowNone
      />

      {/* Children render only above the depth cap; the add affordance is
          guarded the same way. 子节点只在深度上限之内渲染；新增入口以
          相同方式受守卫。 */}
      {canAddZoneMenuChild(path) || (node.children?.length ?? 0) > 0 ? (
        <ZoneMenuNodeList
          nodes={node.children ?? []}
          parentPath={path}
          rootNodes={rootNodes}
          onNodesChange={onNodesChange}
          refUnits={refUnits}
          zonePages={zonePages}
          defaultPageId={defaultPageId}
        />
      ) : null}
    </div>
  );
}
