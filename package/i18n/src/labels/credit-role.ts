import type { CreditAttributionRole } from "@rezics/contract";
import * as m from "../paraglide/messages.js";

const CREDIT_ROLE_MESSAGE = {
  author: m.attribution_credit_role_author,
  "co-author": m.attribution_credit_role_co_author,
  translator: m.attribution_credit_role_translator,
  illustrator: m.attribution_credit_role_illustrator,
  editor: m.attribution_credit_role_editor,
  publisher: m.attribution_credit_role_publisher,
  letterer: m.attribution_credit_role_letterer,
  colorist: m.attribution_credit_role_colorist,
  developer: m.attribution_credit_role_developer,
  composer: m.attribution_credit_role_composer,
  designer: m.attribution_credit_role_designer,
  director: m.attribution_credit_role_director,
  producer: m.attribution_credit_role_producer,
  writer: m.attribution_credit_role_writer,
  actor: m.attribution_credit_role_actor,
  narrator: m.attribution_credit_role_narrator,
  studio: m.attribution_credit_role_studio,
  distributor: m.attribution_credit_role_distributor,
} as const satisfies Record<CreditAttributionRole, () => string>;

export const creditRoleLabel = (role: CreditAttributionRole): string =>
  CREDIT_ROLE_MESSAGE[role]();
