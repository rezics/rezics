import { t } from "elysia";

export const subjectAttributionRoles = [
  "primary_character",
  "featured_character",
  "appears",
  "about",
  "setting",
  "available_on",
  "source_work",
  "canonical_wiki_page",
  "related_subject",
] as const;

export type SubjectAttributionRole = (typeof subjectAttributionRoles)[number];

export const subjectAttributionRoleKeySchema = t.Union(
  subjectAttributionRoles.map((role) => t.Literal(role)) as [
    ReturnType<typeof t.Literal<SubjectAttributionRole>>,
    ReturnType<typeof t.Literal<SubjectAttributionRole>>,
    ...ReturnType<typeof t.Literal<SubjectAttributionRole>>[],
  ],
);
