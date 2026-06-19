import type { RuleScanner } from "../core/types";
import { folderNamingRule } from "./folder-naming";
import { i18nInvariantsRule } from "./i18n-invariants";
import { jsonPolicyRule } from "./json-policy";
import { localeParityRule } from "./locale-parity";
import { queryKeysRule } from "./query-keys";
import { routePrefixRule } from "./route-prefix";
import { safeLinkRule } from "./safe-link";
import { schemaComponentSystemRule } from "./schema-component-system";
import { tokenConsumptionRule } from "./token-consumption";
import { uiAutonomyRule } from "./ui-autonomy";

export const ALL_RULES: RuleScanner[] = [
  routePrefixRule,
  folderNamingRule,
  safeLinkRule,
  queryKeysRule,
  tokenConsumptionRule,
  uiAutonomyRule,
  i18nInvariantsRule,
  localeParityRule,
  jsonPolicyRule,
  schemaComponentSystemRule,
];

export { scanI18nSourceForTest } from "./i18n-invariants";
export { scanJsonPolicyForTest } from "./json-policy";
export { scanFolderNamingForTest } from "./folder-naming";
