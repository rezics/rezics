import type { SystemShelfKindKey, UserUnitProgressStatus } from "@rezics/contract";

export type ShelfOpKind = "add" | "remove";

export type ShelfOp = {
  kind: ShelfOpKind;
  shelfKey: SystemShelfKindKey;
};

const STATUS_TO_MIRRORED_SHELF: Partial<
  Record<UserUnitProgressStatus, SystemShelfKindKey>
> = {
  BACKLOG: "backlog",
  ACTIVE: "active",
};

const STATUS_TO_ADD_ONLY_SHELF: Partial<
  Record<UserUnitProgressStatus, SystemShelfKindKey>
> = {
  COMPLETED: "completed",
};

function mirroredKeyOf(
  status: UserUnitProgressStatus,
): SystemShelfKindKey | null {
  return STATUS_TO_MIRRORED_SHELF[status] ?? null;
}

function addOnlyKeyOf(
  status: UserUnitProgressStatus,
): SystemShelfKindKey | null {
  return STATUS_TO_ADD_ONLY_SHELF[status] ?? null;
}

export function planTransition(
  from: UserUnitProgressStatus | null,
  to: UserUnitProgressStatus,
): ShelfOp[] {
  if (from === to) return [];

  const ops: ShelfOp[] = [];

  if (from) {
    const fromKey = mirroredKeyOf(from);
    if (fromKey) ops.push({ kind: "remove", shelfKey: fromKey });
  }

  const toKey = mirroredKeyOf(to) ?? addOnlyKeyOf(to);
  if (toKey) ops.push({ kind: "add", shelfKey: toKey });

  return ops;
}

export function planRemoveProgress(
  from: UserUnitProgressStatus | null,
): ShelfOp[] {
  if (!from) return [];
  const fromKey = mirroredKeyOf(from);
  return fromKey ? [{ kind: "remove", shelfKey: fromKey }] : [];
}
