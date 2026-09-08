import { sql } from "drizzle-orm";
import type { ContentLanguage } from "@rezics/i18n";
import { database } from "../database";
import { readUnitPresentationsInTransaction } from "../units/presentation-reader";
import { resolvedUnitLocalizationImageAssetId } from "../units/localization";
import { presentImageAsset } from "../api/image-assets/presentation";

/** Caller authorizes this explicit subject before reading its native presentation. */
export async function getPostSubjectPresentation(subjectId:string,localizationLanguages:readonly ContentLanguage[]=[]) {
 return database.transaction(async tx=>{
  const presentation=(await readUnitPresentationsInTransaction(tx,[subjectId],localizationLanguages)).get(subjectId);
  if(!presentation) return null;
  const [asset]=await tx.select({id:resolvedUnitLocalizationImageAssetId(sql`${subjectId}::uuid`,"cover",localizationLanguages)}).from(sql`(values(1)) requested(id)`);
  return {...presentation,cover:presentImageAsset(asset?.id??null,"cover")};
 },{isolationLevel:"repeatable read",accessMode:"read only"});
}
