import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { ContentLanguage } from "@rezics/i18n";
import { database } from "../../database";
import { unitProgress, type ProgressStatus } from "../../database/schema";
import { getUnitReadCondition } from "../../authorization/unit/query";
import { unitStatesForIds } from "../../units/state-relation";
import { readUnitPresentationsInTransaction } from "../../units/presentation-reader";
import { resolvedUnitLocalizationImageAssetId } from "../../units/localization";
import { presentImageAsset } from "../image-assets/presentation";
import { toSafeInteger } from "../../database/integer";
import type { ResolvedProgressSearchRequest } from "./search";

export const ProgressCandidateBudget = 256;
export async function readProgressPage(input: {
 authUserId:string; profileId?:string; languages:readonly ContentLanguage[];
 request:ResolvedProgressSearchRequest; status?:ProgressStatus;
}) {
 const {request}=input;
 const ascending=request.sort === "progressLastSeenAt:asc";
 const boundary=request.boundary;
 return database.transaction(async tx=>{
  const candidates=await tx.select({unitId:unitProgress.unitId,status:unitProgress.status,progress:unitProgress.progress,
   completedCount:unitProgress.completedCount,totalTimeMs:unitProgress.totalTimeMs,firstSeenAt:unitProgress.firstSeenAt,
   lastSeenAt:unitProgress.lastSeenAt,lastContentStructureNodeId:unitProgress.lastContentStructureNodeId,visibility:unitProgress.visibility,
  }).from(unitProgress).where(and(eq(unitProgress.authUserId,input.authUserId),isNull(unitProgress.deletedAt),
   input.status ? eq(unitProgress.status,input.status) : undefined,
   boundary ? ascending ? sql`(${unitProgress.lastSeenAt},${unitProgress.unitId}) > (${new Date(boundary.sortValue!)}::timestamptz,${boundary.unitId}::uuid)`
    : sql`(${unitProgress.lastSeenAt},${unitProgress.unitId}) < (${new Date(boundary.sortValue!)}::timestamptz,${boundary.unitId}::uuid)` : undefined,
  )).orderBy(ascending ? asc(unitProgress.lastSeenAt) : desc(unitProgress.lastSeenAt),ascending ? asc(unitProgress.unitId) : desc(unitProgress.unitId))
   .limit(ProgressCandidateBudget+1);
  const window=candidates.slice(0,ProgressCandidateBudget);
  const state=unitStatesForIds(window.map(row=>row.unitId),"progress_owner");
  const visible=window.length ? await tx.select({id:state.id,owner:state.owner,shape:state.shape,
   coverAssetId:resolvedUnitLocalizationImageAssetId(state.id,"cover",input.languages),
  }).from(state).where(and(getUnitReadCondition(input.profileId,{},state),inArray(state.owner,["publishing","program","music","software","video","audio"]))) : [];
  const presentations=await readUnitPresentationsInTransaction(tx,visible.map(row=>row.id),input.languages);
  const metadata=new Map(visible.map(row=>[row.id,row]));
  const needle=request.query.normalize("NFKC").toLocaleLowerCase();
  const matches=window.flatMap(row=>{
   const presentation=presentations.get(row.unitId), detail=metadata.get(row.unitId);
   if(!presentation||!detail) return [];
   if(needle && ![presentation.title,presentation.summary].some(value=>value?.normalize("NFKC").toLocaleLowerCase().includes(needle))) return [];
   return [{...row,owner:detail.owner,shape:detail.shape,language:presentation.language,title:presentation.title,summary:presentation.summary,
    totalTimeMs:toSafeInteger(row.totalTimeMs,"progress duration"),lastReadAnchor:null,cover:presentImageAsset(detail.coverAssetId,"cover")}];
  });
  const items=matches.slice(0,request.pageSize);
  const knownMore=matches.length>request.pageSize;
  const hasMore=knownMore||candidates.length>ProgressCandidateBudget;
  // Advance only over consumed candidates. A sparse page can be empty with a continuation.
  const last=knownMore ? items.at(-1) : window.at(-1);
  const consumed=request.consumed+items.length;
  return {items,total:{kind:hasMore ? "lower-bound" as const : "exact" as const,value:consumed+(knownMore ? 1 : 0)},consumed,
   boundary:hasMore&&last ? {sortValue:last.lastSeenAt.toISOString(),unitId:last.unitId} : undefined};
 },{isolationLevel:"repeatable read",accessMode:"read only"});
}
