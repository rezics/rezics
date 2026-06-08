import type {
  RealmTagView,
  RealmTagViewStyle,
  TagTreeNode,
} from "@rezics/contract";
import { useLocale } from "@rezics/i18n/react";
import { EmptyState } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
import type React from "react";
import { useEffect, useMemo, useState } from "react";

interface RealmTagBrowserProps {
  realmId: string;
  tagTree?: TagTreeNode[];
  tagView?: RealmTagView | null;
  onTagSelect?: (tagId: string) => void;
}

type TagEntry = {
  tagId: string;
  label: string;
  depth: number;
  groupLabel?: string;
};

const viewLabels: Record<RealmTagViewStyle, string> = {
  flat: "Flat",
  grouped: "Grouped",
  tree: "Tree",
};

export const RealmTagBrowser: React.FC<RealmTagBrowserProps> = ({
  realmId: _realmId,
  tagTree,
  tagView,
  onTagSelect,
}) => {
  const locale = useLocale();
  const entries = useMemo(
    () => collectTags(tagTree, locale),
    [locale, tagTree],
  );
  const [selectedView, setSelectedView] = useState<RealmTagViewStyle>(
    tagView?.defaultStyle ?? "flat",
  );
  useEffect(() => {
    setSelectedView(tagView?.defaultStyle ?? "flat");
  }, [tagView?.defaultStyle]);

  const view = tagView?.allowViewerSwitch
    ? selectedView
    : (tagView?.defaultStyle ?? "flat");

  if (entries.length === 0) {
    return <EmptyState title="No realm tags" />;
  }

  const grouped = groupTags(entries);

  return (
    <div className="flex flex-col gap-4 py-4">
      {tagView?.allowViewerSwitch ? (
        <div className="flex flex-wrap gap-2">
          {(["flat", "grouped", "tree"] as const).map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={selectedView === option ? "default" : "secondary"}
              onClick={() => setSelectedView(option)}
            >
              {viewLabels[option]}
            </Button>
          ))}
        </div>
      ) : null}

      {view === "grouped" ? (
        <div className="grid gap-4">
          {Array.from(grouped).map(([group, items]) => (
            <section key={group} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold leading-ui text-text-primary">
                {group}
              </h2>
              <div className="flex flex-wrap gap-2">
                {items.map((entry) => (
                  <TagChip
                    key={entry.tagId}
                    entry={entry}
                    onTagSelect={onTagSelect}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : view === "tree" ? (
        <div className="grid gap-2">
          {entries.map((entry) => (
            <div
              key={entry.tagId}
              className="flex"
              style={{ paddingInlineStart: `${entry.depth * 1.25}rem` }}
            >
              <TagChip entry={entry} onTagSelect={onTagSelect} />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {entries.map((entry) => (
            <TagChip
              key={entry.tagId}
              entry={entry}
              onTagSelect={onTagSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

function nodeLabel(node: TagTreeNode, language: string) {
  const translations = node.labelTranslations?.translations;
  const fallbackLanguage = node.labelTranslations?.fallbackLanguage;
  return (
    translations?.[language] ??
    (fallbackLanguage ? translations?.[fallbackLanguage] : undefined) ??
    node.label?.trim() ??
    node.tagId?.slice(0, 8) ??
    "Untitled"
  );
}

function collectTags(nodes: TagTreeNode[] | undefined, language: string) {
  const entries: TagEntry[] = [];

  const visit = (
    items: TagTreeNode[],
    depth: number,
    groupLabel: string | undefined,
  ) => {
    for (const item of items) {
      const label = nodeLabel(item, language);
      const nextGroup = depth === 0 ? label : groupLabel;
      if (item.tagId) {
        entries.push({
          tagId: item.tagId,
          label,
          depth,
          groupLabel,
        });
      }
      if (item.children?.length) visit(item.children, depth + 1, nextGroup);
    }
  };

  visit(nodes ?? [], 0, undefined);
  return entries;
}

function groupTags(entries: TagEntry[]) {
  const grouped = new Map<string, TagEntry[]>();
  // Grouped layout is a lossy display projection only. It shows depth 0/1
  // entries and deliberately ignores deeper descendants without mutating or
  // rejecting the stored forest.
  // 分组布局只是一个有损的展示投影：它仅显示深度 0/1 的条目，并刻意忽略更深层的
  // 后代，同时不会修改或拒绝已存储的森林结构。
  for (const entry of entries.filter((item) => item.depth <= 1)) {
    const key = entry.groupLabel ?? "Ungrouped";
    grouped.set(key, [...(grouped.get(key) ?? []), entry]);
  }
  return grouped;
}

function TagChip({
  entry,
  onTagSelect,
}: {
  entry: TagEntry;
  onTagSelect?: (tagId: string) => void;
}) {
  if (!onTagSelect) {
    return (
      <span className="rounded-sm bg-surface-subtle px-3 py-2 text-sm leading-ui text-text-primary">
        {entry.label}
      </span>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      onClick={() => onTagSelect(entry.tagId)}
    >
      {entry.label}
    </Button>
  );
}
