import type { Static } from "elysia";
import { t } from "elysia";
import { createVersionedEnvelopeParser } from "../envelope/envelope";
import { pageSectionSchema } from "./sections";

export const PAGE_SCHEMA = "rezics/page" as const;
export const PAGE_V1_VERSION = 1 as const;

/**
 * Generic page config for page-like surfaces. Zone ownership remains in the
 * `ZonePage` row and zone services; the persisted JSON stores only the page
 * envelope and its ordered sections.
 */
export const pageV1Schema = t.Object(
  {
    schema: t.Literal(PAGE_SCHEMA),
    version: t.Literal(PAGE_V1_VERSION),
    sections: t.Array(pageSectionSchema),
  },
  { additionalProperties: false },
);

export type PageV1 = Static<typeof pageV1Schema>;
export type Page = PageV1;

const pageParser = createVersionedEnvelopeParser<Page>({
  schemaName: PAGE_SCHEMA,
  latestVersion: PAGE_V1_VERSION,
  latestSchema: pageV1Schema,
  versions: [
    {
      version: 1,
      schema: pageV1Schema,
      upgrade: (page) => page as Page,
    },
  ],
});

export const pageEnvelopeSchema = t.Union([pageV1Schema]);

export type PageEnvelope = Page;

export function emptyPage(): Page {
  return {
    schema: PAGE_SCHEMA,
    version: PAGE_V1_VERSION,
    sections: [],
  };
}

export function parsePage(value: unknown): Page | null {
  return pageParser.parse(value);
}
