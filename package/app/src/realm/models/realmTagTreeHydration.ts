import type {
  LabelDTO,
  RealmTagTree,
  RealmTagTreeNode,
} from "@rezics/contract";
import type { BatchTagTranslationResult } from "@rezics/contract";

export type RealmTagTreeDisplayNames = ReadonlyMap<string, string>;

export function collectRealmTagTreeUnitIds(
  tree: RealmTagTree | null | undefined,
) {
  const tagUnitIds = new Set<string>();
  const labelUnitIds = new Set<string>();
  const visit = (nodes: readonly RealmTagTreeNode[]) => {
    for (const node of nodes) {
      if (node.kind === "tag") {
        tagUnitIds.add(node.tagUnitId);
        if (node.labelUnitId) labelUnitIds.add(node.labelUnitId);
      } else {
        labelUnitIds.add(node.labelUnitId);
      }
      if (node.children?.length) visit(node.children);
    }
  };
  visit(tree?.nodes ?? []);
  return {
    tagUnitIds: [...tagUnitIds].sort(),
    labelUnitIds: [...labelUnitIds].sort(),
  };
}

function labelTitle(label: LabelDTO, language: string) {
  return (
    label.translations.find((item) => item.language === language)?.title ??
    label.translations.find((item) => item.title)?.title ??
    null
  );
}

export function buildRealmTagTreeDisplayNames(input: {
  tagTranslations?: BatchTagTranslationResult | null;
  labels?: LabelDTO[] | null;
  language: string;
}): RealmTagTreeDisplayNames {
  const names = new Map<string, string>();
  for (const [unitId, translation] of Object.entries(
    input.tagTranslations ?? {},
  )) {
    if (translation.name?.trim()) names.set(unitId, translation.name.trim());
  }
  for (const label of input.labels ?? []) {
    const title = labelTitle(label, input.language);
    if (title?.trim()) names.set(label.unitId, title.trim());
  }
  return names;
}

export function realmTagTreeNodeDisplayLabel(
  node: RealmTagTreeNode,
  names: RealmTagTreeDisplayNames | undefined,
) {
  if (node.kind === "tag") {
    return (
      (node.labelUnitId ? names?.get(node.labelUnitId) : undefined) ??
      names?.get(node.tagUnitId) ??
      node.tagUnitId.slice(0, 8)
    );
  }
  return names?.get(node.labelUnitId) ?? node.labelUnitId.slice(0, 8);
}
