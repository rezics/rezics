export interface TreeEditOp {
  id: string;
  type: string;
  targetId?: string;
  label?: string;
  options?: Record<string, unknown>;
}

export interface TreeEditOpLog {
  entries: TreeEditOp[];
  nextSeq: number;
}

export const emptyTreeEditOpLog: TreeEditOpLog = {
  entries: [],
  nextSeq: 1,
};

export function enqueueTreeEditOp(
  log: TreeEditOpLog,
  op: Omit<TreeEditOp, "id">,
): TreeEditOpLog {
  return {
    entries: [...log.entries, { ...op, id: `tree-op-${log.nextSeq}` }],
    nextSeq: log.nextSeq + 1,
  };
}

export function clearTreeEditOpLog(log: TreeEditOpLog): TreeEditOpLog {
  return { entries: [], nextSeq: log.nextSeq };
}
