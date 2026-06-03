import type { PolicyAction } from "@rezics/contract";
import type { GovernanceActionDefinition } from "./registry";

export const contentPolicyActions = {
  create: "content.create",
  delete: "content.delete",
  takedown: "content.takedown",
  lock: "content.lock",
  archive: "content.archive",
  restore: "content.restore",
  commentModerate: "comment.moderate",
  reactionCreate: "reaction.create",
} as const satisfies Record<string, PolicyAction>;

export const contentActionDefinitions = [
  {
    action: contentPolicyActions.create,
    family: "content",
  },
  {
    action: contentPolicyActions.delete,
    requiredCapability: "content.takedown",
    family: "content",
  },
  {
    action: contentPolicyActions.takedown,
    requiredCapability: "content.takedown",
    family: "content",
  },
  {
    action: contentPolicyActions.lock,
    requiredCapability: "content.lock",
    family: "content",
  },
  {
    action: contentPolicyActions.archive,
    requiredCapability: "content.archive",
    family: "content",
  },
  {
    action: contentPolicyActions.restore,
    requiredCapability: "content.restore",
    family: "content",
  },
  {
    action: contentPolicyActions.commentModerate,
    requiredCapability: "comment.moderate",
    family: "content",
    realmScoped: true,
  },
  {
    action: contentPolicyActions.reactionCreate,
    family: "content",
  },
] as const satisfies readonly GovernanceActionDefinition[];
