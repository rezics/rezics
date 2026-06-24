import { defineRelations } from "drizzle-orm";
import * as schema from "../schema/schema";
import { aliasRelations } from "./alias-relations";
import { attributionRelations } from "./attribution-relations";
import { contentRelations } from "./content-relations";
import { engagementRelations } from "./engagement-relations";
import { externalLinkRelations } from "./external-link-relations";
import { governanceRelations } from "./governance-relations";
import { identityRelations } from "./identity-relations";
import { jwtRelations } from "./jwt-relations";
import { miscRelations } from "./misc-relations";
import { pollRelations } from "./poll-relations";
import { realmRelations } from "./realm-relations";
import { scoreRelations } from "./score-relations";
import { seriesRelations } from "./series-relations";
import { shelfRelations } from "./shelf-relations";
import { taggingRelations } from "./tagging-relations";
import { unitRelations } from "./unit-relations";
import { workRelations } from "./work-relations";

export const relations = defineRelations(schema, (r) => ({
  ...aliasRelations(r),
  ...attributionRelations(r),
  ...contentRelations(r),
  ...engagementRelations(r),
  ...governanceRelations(r),
  ...identityRelations(r),
  ...jwtRelations(r),
  ...miscRelations(r),
  ...pollRelations(r),
  ...realmRelations(r),
  ...scoreRelations(r),
  ...seriesRelations(r),
  ...shelfRelations(r),
  ...externalLinkRelations(r),
  ...taggingRelations(r),
  ...unitRelations(r),
  ...workRelations(r),
}));
