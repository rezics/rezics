import type { TreeDropIntent } from "./types";

export function resolveTreeDropIntent(input: {
  pointerX: number;
  rowLeft: number;
  pointerY: number;
  rowTop: number;
  rowHeight: number;
  indentThreshold?: number;
}): TreeDropIntent {
  const verticalRatio = (input.pointerY - input.rowTop) / input.rowHeight;
  if (input.pointerX - input.rowLeft > (input.indentThreshold ?? 40)) {
    return "inside";
  }
  if (verticalRatio < 0.25) return "before";
  if (verticalRatio > 0.75) return "after";
  return "inside";
}
