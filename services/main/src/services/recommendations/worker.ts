import { and, desc, eq, lt, ne, sql } from "drizzle-orm";
import { database } from "../database";
import { env } from "../config";
import { recommendationSnapshot } from "../database/schema";
import { RecommendationPolicy, RecommendationPolicyVersion } from "./policy";
import { dispatchRecommendationBuild, finalizeRecommendationSnapshot } from "./build-partitions";

/** One tick advances a bounded share of the durable build. */
export function dispatchRecommendationRefresh() {
 return dispatchRecommendationBuild(database, env.RECOMMENDATION_REFRESH_INTERVAL_MS);
}

/** Each maintenance run has a fixed deletion budget. Backlogs remain visible and drain over later runs. */
export async function purgeRecommendationData(now = new Date()) {
 const eventBoundary=new Date(now.getTime()-RecommendationPolicy.eventRetentionDays*86_400_000);
 // Upcoming snapshots use a UTC-hour cut, so keep its entire oldest bucket even between builds.
 const hourBoundary=Math.floor(now.getTime()/3_600_000)*3_600_000;
 let signalBoundary=new Date(hourBoundary-RecommendationPolicy.signalRetentionDays*86_400_000);
 const [building]=await database.select({id:recommendationSnapshot.id,startedAt:recommendationSnapshot.startedAt,watermark:recommendationSnapshot.sourceWatermark})
  .from(recommendationSnapshot).where(eq(recommendationSnapshot.state,"building")).limit(1);
 if(building) {
  const stillBuilding=building.startedAt.getTime()<=now.getTime()-RecommendationPolicy.buildDeadlineMs
   ? await finalizeRecommendationSnapshot(database,building.id)==="building" : true;
  if(stillBuilding && building.watermark)
   signalBoundary=new Date(Math.min(signalBoundary.getTime(),building.watermark.getTime()-RecommendationPolicy.bestWindowDays*86_400_000));
 }
 const snapshotBoundary=new Date(now.getTime()-RecommendationPolicy.snapshotRetentionHours*3_600_000);
 const snapshots=await database.select({id:recommendationSnapshot.id}).from(recommendationSnapshot)
  .where(and(eq(recommendationSnapshot.active,false),ne(recommendationSnapshot.state,"building"),lt(recommendationSnapshot.startedAt,snapshotBoundary)))
  .orderBy(recommendationSnapshot.startedAt,recommendationSnapshot.id).limit(4);
 for (const snapshot of snapshots) {
  await database.execute(sql`delete from unit_best_score where (snapshot_id,unit_id) in (
   select snapshot_id,unit_id from unit_best_score where snapshot_id=${snapshot.id}::uuid order by unit_id limit 10000 for update skip locked
  )`);
  await database.delete(recommendationSnapshot).where(and(eq(recommendationSnapshot.id,snapshot.id),
   eq(recommendationSnapshot.active,false),sql`not exists(select 1 from unit_best_score where snapshot_id=${snapshot.id}::uuid)`));
 }
 await database.execute(sql`delete from recommendation_event where id in (
  select id from recommendation_event where occurred_at < ${eventBoundary} order by occurred_at,id limit 10000 for update skip locked
 )`);
 await database.execute(sql`delete from recommendation_unit_signal_hourly where (unit_id,bucket_start,kind) in (
  select unit_id,bucket_start,kind from recommendation_unit_signal_hourly where bucket_start < ${signalBoundary} order by bucket_start,unit_id,kind limit 10000 for update skip locked
 )`);
}

export async function getRecommendationHealth(now = new Date()) {
	const [snapshot] = await database
		.select({
			id: recommendationSnapshot.id,
			policyVersion: recommendationSnapshot.policyVersion,
			completedAt: recommendationSnapshot.completedAt,
		})
		.from(recommendationSnapshot)
		.where(eq(recommendationSnapshot.active, true))
		.orderBy(desc(recommendationSnapshot.completedAt))
		.limit(1);
	const ageMs = snapshot?.completedAt ? now.getTime() - snapshot.completedAt.getTime() : null;
	return {
		ready: ageMs !== null && ageMs <= RecommendationPolicy.snapshotStaleHours * 3_600_000,
		snapshotId: snapshot?.id ?? null,
		policyVersion: snapshot?.policyVersion ?? RecommendationPolicyVersion,
		ageMs,
	};
}
