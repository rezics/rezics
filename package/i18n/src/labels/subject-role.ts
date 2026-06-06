import type { SubjectAttributionRole } from "@rezics/contract";

import { getI18nRuntime } from "../runtime.ts";

const SUBJECT_ROLE_KEY = {
  primary_character: "entity:attribution_subject_role_primary_character",
  featured_character: "entity:attribution_subject_role_featured_character",
  appears: "entity:attribution_subject_role_appears",
  about: "entity:attribution_subject_role_about",
  setting: "entity:attribution_subject_role_setting",
  available_on: "entity:attribution_subject_role_available_on",
  source_work: "entity:attribution_subject_role_source_work",
  canonical_wiki_page: "entity:attribution_subject_role_canonical_wiki_page",
  related_subject: "entity:attribution_subject_role_related_subject",
} as const satisfies Record<SubjectAttributionRole, `entity:${string}`>;

export const subjectRoleLabel = (role: SubjectAttributionRole): string =>
  getI18nRuntime().i18n.t(SUBJECT_ROLE_KEY[role]);
