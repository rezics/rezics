import type { SubjectAttributionRole } from "@rezics/contract";
import * as m from "../paraglide/messages.js";

const SUBJECT_ROLE_MESSAGE = {
  primary_character: m.attribution_subject_role_primary_character,
  featured_character: m.attribution_subject_role_featured_character,
  appears: m.attribution_subject_role_appears,
  about: m.attribution_subject_role_about,
  setting: m.attribution_subject_role_setting,
  source_work: m.attribution_subject_role_source_work,
  canonical_wiki_page: m.attribution_subject_role_canonical_wiki_page,
  related_subject: m.attribution_subject_role_related_subject,
} as const satisfies Record<SubjectAttributionRole, () => string>;

export const subjectRoleLabel = (role: SubjectAttributionRole): string =>
  SUBJECT_ROLE_MESSAGE[role]();
