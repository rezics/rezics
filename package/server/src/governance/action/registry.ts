import type { Capability, PolicyAction } from "@rezics/contract";
import { accountActionDefinitions } from "./account";
import { contentActionDefinitions } from "./content";
import { realmActionDefinitions } from "./realm";
import { siteActionDefinitions } from "./site";

export type GovernanceActionFamily =
  | "account"
  | "audit"
  | "case"
  | "content"
  | "operation"
  | "realm"
  | "staff-console";

export type GovernanceActionDefinition = {
  action: PolicyAction;
  family: GovernanceActionFamily;
  requiredCapability?: Capability;
  realmScoped?: boolean;
};

export const governanceActionDefinitions = [
  ...accountActionDefinitions,
  ...contentActionDefinitions,
  ...realmActionDefinitions,
  ...siteActionDefinitions,
] as const satisfies readonly GovernanceActionDefinition[];

export const governanceActionDefinitionByAction = new Map<
  PolicyAction,
  GovernanceActionDefinition
>(
  governanceActionDefinitions.map((definition) => [
    definition.action,
    definition as GovernanceActionDefinition,
  ]),
);
