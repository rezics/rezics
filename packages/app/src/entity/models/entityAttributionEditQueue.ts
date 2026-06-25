import type {
  CreditAttributionDTO,
  CreditAttributionRole,
  EntityAttributionBatchOp,
  SubjectAttributionDTO,
  SubjectAttributionRole,
} from "@rezics/contract";
import { generateKeyBetween } from "@rezics/contract/shared/fractional-index";

export type EntityAttributionQueueSaveStatus =
  | "idle"
  | "saving"
  | "saved"
  | "error";

export type CreditAttributionQueueEntry = {
  entityId: string;
  role: CreditAttributionRole;
  position: string;
  entity?: CreditAttributionDTO["entity"];
};

export type SubjectAttributionQueueEntry = {
  entityId: string;
  role: SubjectAttributionRole;
  position: string;
  weight: number | null;
  entity?: SubjectAttributionDTO["entity"];
};

export type EntityAttributionQueueSnapshot = {
  credits: Record<string, CreditAttributionQueueEntry[]>;
  subjects: Record<string, SubjectAttributionQueueEntry[]>;
};

export type EntityAttributionEditQueue = {
  initial: EntityAttributionQueueSnapshot;
  current: EntityAttributionQueueSnapshot;
  saveStatus: EntityAttributionQueueSaveStatus;
  error: Error | null;
};

type QueueInput = {
  credits?: readonly CreditAttributionDTO[];
  subjects?: readonly SubjectAttributionDTO[];
};

function positionsForOrder(count: number): string[] {
  const positions: string[] = [];
  let previous: string | undefined;
  for (let index = 0; index < count; index += 1) {
    previous = generateKeyBetween(previous, undefined);
    positions.push(previous);
  }
  return positions;
}

function sortByPosition<T extends { position: string; entityId: string }>(
  entries: readonly T[],
): T[] {
  return [...entries].sort(
    (a, b) =>
      a.position.localeCompare(b.position) ||
      a.entityId.localeCompare(b.entityId),
  );
}

function normalizePositions<T extends { position: string }>(entries: T[]): T[] {
  const positions = positionsForOrder(entries.length);
  return entries.map((entry, index) => ({
    ...entry,
    position: positions[index]!,
  }));
}

function groupCredits(
  credits: readonly CreditAttributionDTO[] = [],
): Record<string, CreditAttributionQueueEntry[]> {
  const grouped: Record<string, CreditAttributionQueueEntry[]> = {};
  for (const credit of credits) {
    grouped[credit.role] ??= [];
    grouped[credit.role]?.push({
      entityId: credit.entityId,
      role: credit.role,
      position: credit.position,
      entity: credit.entity,
    });
  }
  for (const [role, entries] of Object.entries(grouped)) {
    grouped[role] = normalizePositions(sortByPosition(entries));
  }
  return grouped;
}

function groupSubjects(
  subjects: readonly SubjectAttributionDTO[] = [],
): Record<string, SubjectAttributionQueueEntry[]> {
  const grouped: Record<string, SubjectAttributionQueueEntry[]> = {};
  for (const subject of subjects) {
    grouped[subject.role] ??= [];
    grouped[subject.role]?.push({
      entityId: subject.entityId,
      role: subject.role,
      position: subject.position,
      weight: subject.weight ?? null,
      entity: subject.entity,
    });
  }
  for (const [role, entries] of Object.entries(grouped)) {
    grouped[role] = normalizePositions(sortByPosition(entries));
  }
  return grouped;
}

function cloneSnapshot(
  snapshot: EntityAttributionQueueSnapshot,
): EntityAttributionQueueSnapshot {
  return {
    credits: Object.fromEntries(
      Object.entries(snapshot.credits).map(([role, entries]) => [
        role,
        entries.map((entry) => ({ ...entry })),
      ]),
    ),
    subjects: Object.fromEntries(
      Object.entries(snapshot.subjects).map(([role, entries]) => [
        role,
        entries.map((entry) => ({ ...entry })),
      ]),
    ),
  };
}

function createSnapshot(input: QueueInput): EntityAttributionQueueSnapshot {
  return {
    credits: groupCredits(input.credits),
    subjects: groupSubjects(input.subjects),
  };
}

export function createEntityAttributionEditQueue(
  input: QueueInput = {},
): EntityAttributionEditQueue {
  const snapshot = createSnapshot(input);
  return {
    initial: cloneSnapshot(snapshot),
    current: snapshot,
    saveStatus: "idle",
    error: null,
  };
}

function updateQueue(
  queue: EntityAttributionEditQueue,
  updater: (current: EntityAttributionQueueSnapshot) => void,
): EntityAttributionEditQueue {
  const current = cloneSnapshot(queue.current);
  updater(current);
  return { ...queue, current, saveStatus: "idle", error: null };
}

export function replaceCreditAttributions(
  queue: EntityAttributionEditQueue,
  role: CreditAttributionRole,
  entries: readonly Omit<CreditAttributionQueueEntry, "role" | "position">[],
): EntityAttributionEditQueue {
  return updateQueue(queue, (current) => {
    const positions = positionsForOrder(entries.length);
    current.credits[role] = entries.map((entry, index) => ({
      ...entry,
      role,
      position: positions[index]!,
    }));
  });
}

export function addCreditAttribution(
  queue: EntityAttributionEditQueue,
  role: CreditAttributionRole,
  entry: Omit<CreditAttributionQueueEntry, "role" | "position">,
): EntityAttributionEditQueue {
  return updateQueue(queue, (current) => {
    const existing = current.credits[role] ?? [];
    const withoutDuplicate = existing.filter(
      (item) => item.entityId !== entry.entityId,
    );
    current.credits[role] = normalizePositions([
      ...withoutDuplicate,
      { ...entry, role, position: generateKeyBetween(undefined, undefined) },
    ]);
  });
}

export function removeCreditAttribution(
  queue: EntityAttributionEditQueue,
  role: CreditAttributionRole,
  entityId: string,
): EntityAttributionEditQueue {
  return updateQueue(queue, (current) => {
    current.credits[role] = normalizePositions(
      (current.credits[role] ?? []).filter(
        (entry) => entry.entityId !== entityId,
      ),
    );
  });
}

export function reorderCreditAttributions(
  queue: EntityAttributionEditQueue,
  role: CreditAttributionRole,
  entityIds: readonly string[],
): EntityAttributionEditQueue {
  return updateQueue(queue, (current) => {
    const byId = new Map(
      (current.credits[role] ?? []).map((entry) => [entry.entityId, entry]),
    );
    current.credits[role] = entityIds
      .map((entityId) => byId.get(entityId))
      .filter((entry): entry is CreditAttributionQueueEntry => !!entry)
      .map((entry) => ({ ...entry }));
    current.credits[role] = normalizePositions(current.credits[role] ?? []);
  });
}

export function replaceSubjectAttributions(
  queue: EntityAttributionEditQueue,
  role: SubjectAttributionRole,
  entries: readonly Omit<SubjectAttributionQueueEntry, "role" | "position">[],
): EntityAttributionEditQueue {
  return updateQueue(queue, (current) => {
    const positions = positionsForOrder(entries.length);
    current.subjects[role] = entries.map((entry, index) => ({
      ...entry,
      role,
      position: positions[index]!,
      weight: entry.weight ?? null,
    }));
  });
}

export function addSubjectAttribution(
  queue: EntityAttributionEditQueue,
  role: SubjectAttributionRole,
  entry: Omit<SubjectAttributionQueueEntry, "role" | "position">,
): EntityAttributionEditQueue {
  return updateQueue(queue, (current) => {
    const existing = current.subjects[role] ?? [];
    const withoutDuplicate = existing.filter(
      (item) => item.entityId !== entry.entityId,
    );
    current.subjects[role] = normalizePositions([
      ...withoutDuplicate,
      {
        ...entry,
        role,
        position: generateKeyBetween(undefined, undefined),
        weight: entry.weight ?? null,
      },
    ]);
  });
}

export function removeSubjectAttribution(
  queue: EntityAttributionEditQueue,
  role: SubjectAttributionRole,
  entityId: string,
): EntityAttributionEditQueue {
  return updateQueue(queue, (current) => {
    current.subjects[role] = normalizePositions(
      (current.subjects[role] ?? []).filter(
        (entry) => entry.entityId !== entityId,
      ),
    );
  });
}

export function reorderSubjectAttributions(
  queue: EntityAttributionEditQueue,
  role: SubjectAttributionRole,
  entityIds: readonly string[],
): EntityAttributionEditQueue {
  return updateQueue(queue, (current) => {
    const byId = new Map(
      (current.subjects[role] ?? []).map((entry) => [entry.entityId, entry]),
    );
    current.subjects[role] = entityIds
      .map((entityId) => byId.get(entityId))
      .filter((entry): entry is SubjectAttributionQueueEntry => !!entry)
      .map((entry) => ({ ...entry }));
    current.subjects[role] = normalizePositions(current.subjects[role] ?? []);
  });
}

function creditEntriesEqual(
  a: readonly CreditAttributionQueueEntry[] = [],
  b: readonly CreditAttributionQueueEntry[] = [],
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (entry, index) =>
        entry.entityId === b[index]?.entityId &&
        entry.role === b[index]?.role &&
        entry.position === b[index]?.position,
    )
  );
}

function subjectEntriesEqual(
  a: readonly SubjectAttributionQueueEntry[] = [],
  b: readonly SubjectAttributionQueueEntry[] = [],
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (entry, index) =>
        entry.entityId === b[index]?.entityId &&
        entry.role === b[index]?.role &&
        entry.position === b[index]?.position &&
        entry.weight === b[index]?.weight,
    )
  );
}

function dirtyRoles<T>(
  initial: Record<string, T[]>,
  current: Record<string, T[]>,
  compare: (a?: readonly T[], b?: readonly T[]) => boolean,
): string[] {
  const roles = new Set([...Object.keys(initial), ...Object.keys(current)]);
  return [...roles].filter((role) => !compare(initial[role], current[role]));
}

export function isEntityAttributionQueueDirty(
  queue: EntityAttributionEditQueue,
): boolean {
  return buildEntityAttributionBatchOps(queue).length > 0;
}

export function buildEntityAttributionBatchOps(
  queue: EntityAttributionEditQueue,
): EntityAttributionBatchOp[] {
  const creditOps = dirtyRoles(
    queue.initial.credits,
    queue.current.credits,
    creditEntriesEqual,
  ).map((role) => ({
    op: "setCredits" as const,
    role: role as CreditAttributionRole,
    entries: (queue.current.credits[role] ?? []).map((entry) => ({
      entityId: entry.entityId,
      position: entry.position,
    })),
  }));

  const subjectOps = dirtyRoles(
    queue.initial.subjects,
    queue.current.subjects,
    subjectEntriesEqual,
  ).map((role) => ({
    op: "setSubjects" as const,
    role: role as SubjectAttributionRole,
    entries: (queue.current.subjects[role] ?? []).map((entry) => ({
      entityId: entry.entityId,
      position: entry.position,
      weight: entry.weight,
    })),
  }));

  return [...creditOps, ...subjectOps];
}

export function markEntityAttributionQueueSaving(
  queue: EntityAttributionEditQueue,
): EntityAttributionEditQueue {
  return { ...queue, saveStatus: "saving", error: null };
}

export function markEntityAttributionQueueError(
  queue: EntityAttributionEditQueue,
  error: Error,
): EntityAttributionEditQueue {
  return { ...queue, saveStatus: "error", error };
}

export function markEntityAttributionQueueSaved(
  queue: EntityAttributionEditQueue,
  input?: QueueInput,
): EntityAttributionEditQueue {
  const current = input ? createSnapshot(input) : cloneSnapshot(queue.current);
  return {
    initial: cloneSnapshot(current),
    current,
    saveStatus: "saved",
    error: null,
  };
}
