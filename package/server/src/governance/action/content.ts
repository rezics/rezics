import type { PolicyAction } from "@rezics/contract";

export const contentPolicyActions = {
  create: "content.create",
  delete: "content.delete",
  takedown: "content.takedown",
  lock: "content.lock",
  archive: "content.archive",
  restore: "content.restore",
} as const satisfies Record<string, PolicyAction>;
