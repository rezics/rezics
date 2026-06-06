import type { RuleScanner } from "../core/types";
import { folderNamingRule } from "./folder-naming";
import { i18nInvariantsRule } from "./i18n-invariants";
import { localeParityRule } from "./locale-parity";
import { queryKeysRule } from "./query-keys";
import { routePrefixRule } from "./route-prefix";
import { safeLinkRule } from "./safe-link";
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
];

export { scanI18nSourceForTest } from "./i18n-invariants";
