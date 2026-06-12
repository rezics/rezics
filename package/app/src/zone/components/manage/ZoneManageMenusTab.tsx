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
  removeZoneMenuNodeAtPath,
  updateZoneMenuNodeAtPath,
  type ZoneMenuNodePath,
} from "../../models/zoneManageDraft";
import type { ZoneRefUnitMap } from "../../models/zoneMenu";
import { ZoneLabelField } from "./ZoneLabelField";
import { ZoneLinkTargetField } from "./ZoneLinkTargetField";
import { ManageField, RowActions } from "./ZoneManageFields";

function collectNodeIds(nodes: readonly ZoneMenuNode[], out: string[] = []) {
  for (const node of nodes) {
    out.push(node.id);
    if (node.children) collectNodeIds(node.children, out);
  }
  return out;
}

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
}: {
  draft: ZoneManageDraft;
  onDraftChange: (draft: ZoneManageDraft) => void;
  refUnits: ZoneRefUnitMap;
}) {
  const { t } = useTranslation(["zone", "common"]);

  const updateMenu = (index: number, menu: ZoneMenu) => {
    onDraftChange({
      ...draft,
      menus: draft.menus.map((current, currentIndex) =>
        currentIndex === index ? menu : current,
      ),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <Card surface="contained">
        <CardContent className="p-4">
          <ManageField label={t("zone:manage_header_menu")}>
            <Select
              value={draft.header.menuId}
              onValueChange={(menuId) =>
                onDraftChange({
                  ...draft,
                  header: { ...draft.header, menuId },
                })
              }
            >
              <SelectTrigger className="w-56 font-mono text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {draft.menus.map((menu) => (
                  <SelectItem
                    key={menu.id}
                    value={menu.id}
                    className="font-mono"
                  >
                    {menu.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ManageField>
        </CardContent>
      </Card>

      {draft.menus.map((menu, index) => (
        <Card surface="contained" key={menu.id}>
          <CardContent className="flex flex-col gap-4 p-4">
            <div className="flex items-end justify-between gap-3">
              <ManageField label={t("zone:manage_menu_id")}>
                <Input
                  value={menu.id}
                  className="w-56 font-mono text-sm"
                  onChange={(event) =>
                    updateMenu(index, { ...menu, id: event.target.value })
                  }
                />
              </ManageField>
              <RowActions
                onRemove={() =>
                  onDraftChange({
                    ...draft,
                    menus: draft.menus.filter(
                      (_, currentIndex) => currentIndex !== index,
                    ),
                  })
                }
              />
            </div>

            <ZoneMenuNodeList
              nodes={menu.nodes}
              parentPath={[]}
              rootNodes={menu.nodes}
              onNodesChange={(nodes) => updateMenu(index, { ...menu, nodes })}
              refUnits={refUnits}
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
                  id: nextZoneId(
                    "menu",
                    draft.menus.map((menu) => menu.id),
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
}: {
  nodes: readonly ZoneMenuNode[];
  parentPath: ZoneMenuNodePath;
  rootNodes: readonly ZoneMenuNode[];
  onNodesChange: (nodes: ZoneMenuNode[]) => void;
  refUnits: ZoneRefUnitMap;
}) {
  const { t } = useTranslation(["zone", "common"]);

  const addNode = () => {
    const id = nextZoneId("item", collectNodeIds(rootNodes));
    const inserted = insertZoneMenuNode(rootNodes, parentPath, {
      id,
      target: { kind: "zonePage", pageId: "home" },
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
          key={node.id}
          node={node}
          path={[...parentPath, index]}
          siblingCount={nodes.length}
          rootNodes={rootNodes}
          onNodesChange={onNodesChange}
          refUnits={refUnits}
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
}: {
  node: ZoneMenuNode;
  path: ZoneMenuNodePath;
  siblingCount: number;
  rootNodes: readonly ZoneMenuNode[];
  onNodesChange: (nodes: ZoneMenuNode[]) => void;
  refUnits: ZoneRefUnitMap;
}) {
  const { t } = useTranslation(["zone", "common"]);
  const index = path[path.length - 1] as number;

  const apply = (result: ZoneMenuNode[] | null) => {
    if (result) onNodesChange(result);
  };

  return (
    <div className="flex flex-col gap-3 rounded-md bg-surface-subtle p-3">
      <div className="flex items-end justify-between gap-3">
        <ManageField label={t("zone:manage_node_id")}>
          <Input
            value={node.id}
            className="w-44 font-mono text-sm"
            onChange={(event) =>
              onNodesChange(
                updateZoneMenuNodeAtPath(rootNodes, path, (current) => ({
                  ...current,
                  id: event.target.value,
                })),
              )
            }
          />
        </ManageField>
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
        />
      ) : null}
    </div>
  );
}
