import { generateKeyBetween } from "@rezics/api/shared/fractional-index";
import type { UserSubscriptionListSort } from "@rezics/contract";

export const DEFAULT_SUBSCRIPTION_LIST_SORT: UserSubscriptionListSort =
  "manualAsc";

export const SUBSCRIPTION_LIST_SORTS: readonly UserSubscriptionListSort[] = [
  "manualAsc",
  "manualDesc",
  "addedDesc",
  "addedAsc",
];

export interface SubscriptionListSortable {
  pinned?: boolean;
  position?: string;
  createdAt?: string | Date;
}

export interface SubscriptionListDragItem extends SubscriptionListSortable {
  id: string;
  position: string;
}

export function normalizeSubscriptionListSort(
  sort: UserSubscriptionListSort | string | null | undefined,
): UserSubscriptionListSort {
  return SUBSCRIPTION_LIST_SORTS.includes(sort as UserSubscriptionListSort)
    ? (sort as UserSubscriptionListSort)
    : DEFAULT_SUBSCRIPTION_LIST_SORT;
}

export function isManualSubscriptionListSort(
  sort: UserSubscriptionListSort | string | null | undefined,
): boolean {
  const normalized = normalizeSubscriptionListSort(sort);
  return normalized === "manualAsc" || normalized === "manualDesc";
}

function timeValue(value: string | Date | undefined): number {
  if (!value) return 0;
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export function sortSubscriptionListItems<T extends SubscriptionListSortable>(
  items: readonly T[],
  sort: UserSubscriptionListSort | string | null | undefined,
): T[] {
  const normalized = normalizeSubscriptionListSort(sort);
  return [...items].sort((a, b) => {
    const pinnedA = a.pinned ?? false;
    const pinnedB = b.pinned ?? false;
    if (pinnedA !== pinnedB) return pinnedA ? -1 : 1;

    const positionA = a.position ?? "";
    const positionB = b.position ?? "";
    const createdAtA = timeValue(a.createdAt);
    const createdAtB = timeValue(b.createdAt);

    switch (normalized) {
      case "manualDesc":
        return positionB.localeCompare(positionA) || createdAtB - createdAtA;
      case "addedDesc":
        return createdAtB - createdAtA || positionB.localeCompare(positionA);
      case "addedAsc":
        return createdAtA - createdAtB || positionA.localeCompare(positionB);
      default:
        return positionA.localeCompare(positionB) || createdAtA - createdAtB;
    }
  });
}

function moveBlock<T>(
  items: readonly T[],
  block: readonly T[],
  active: T,
  over: T,
): T[] {
  const blockSet = new Set(block);
  const withoutBlock = items.filter((item) => !blockSet.has(item));
  const overIndex = withoutBlock.indexOf(over);
  if (overIndex < 0) return [...items];
  const activeIndex = items.indexOf(active);
  const originalOverIndex = items.indexOf(over);
  const insertIndex =
    activeIndex < originalOverIndex ? overIndex + 1 : overIndex;
  return [
    ...withoutBlock.slice(0, insertIndex),
    ...block,
    ...withoutBlock.slice(insertIndex),
  ];
}

export function reorderSubscriptionListItems<
  T extends SubscriptionListDragItem,
>(input: {
  visualItems: readonly T[];
  activeId: string;
  overId: string;
  selectedIds: ReadonlySet<string>;
  sort: UserSubscriptionListSort | string | null | undefined;
}): Array<{ id: string; position: string }> {
  const normalized = normalizeSubscriptionListSort(input.sort);
  const active = input.visualItems.find((item) => item.id === input.activeId);
  const over = input.visualItems.find((item) => item.id === input.overId);
  if (!active || !over || active.id === over.id) return [];
  if ((active.pinned ?? false) !== (over.pinned ?? false)) return [];

  const activePinned = active.pinned ?? false;
  const samePinnedItems = input.visualItems.filter(
    (item) => (item.pinned ?? false) === activePinned,
  );
  const selectedInGroup = samePinnedItems.filter((item) =>
    input.selectedIds.has(item.id),
  );
  const movingBlock = selectedInGroup.some((item) => item.id === active.id)
    ? selectedInGroup
    : [active];
  const reorderedVisualGroup = moveBlock(
    samePinnedItems,
    movingBlock,
    active,
    over,
  );
  const canonicalGroup =
    normalized === "manualDesc"
      ? [...reorderedVisualGroup].reverse()
      : reorderedVisualGroup;

  let previous: string | undefined;
  return canonicalGroup.map((item) => {
    const position = generateKeyBetween(previous, undefined);
    previous = position;
    return { id: item.id, position };
  });
}
