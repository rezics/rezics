import type { CreditAttributionRole } from "@rezics/contract";

import { getI18nRuntime } from "../runtime.ts";

const CREDIT_ROLE_KEY = {
  author: "entity:attribution_credit_role_author",
  "co-author": "entity:attribution_credit_role_co_author",
  translator: "entity:attribution_credit_role_translator",
  illustrator: "entity:attribution_credit_role_illustrator",
  editor: "entity:attribution_credit_role_editor",
  publisher: "entity:attribution_credit_role_publisher",
  letterer: "entity:attribution_credit_role_letterer",
  colorist: "entity:attribution_credit_role_colorist",
  developer: "entity:attribution_credit_role_developer",
  composer: "entity:attribution_credit_role_composer",
  designer: "entity:attribution_credit_role_designer",
  director: "entity:attribution_credit_role_director",
  producer: "entity:attribution_credit_role_producer",
  writer: "entity:attribution_credit_role_writer",
  actor: "entity:attribution_credit_role_actor",
  narrator: "entity:attribution_credit_role_narrator",
  studio: "entity:attribution_credit_role_studio",
  distributor: "entity:attribution_credit_role_distributor",
} as const satisfies Record<CreditAttributionRole, `entity:${string}`>;

export const creditRoleLabel = (role: CreditAttributionRole): string =>
  getI18nRuntime().i18n.t(CREDIT_ROLE_KEY[role]);
