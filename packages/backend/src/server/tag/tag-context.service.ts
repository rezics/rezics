import { and, asc, desc, eq, gt, inArray } from "drizzle-orm";
import {
  RealmMember,
  RealmTagApplication,
  RealmTagApplicationVote,
  RealmTagContext,
  TagVote,
  UnitTag,
  UnitTranslation,
} from "../db/schema";
import { VISIBILITY_THRESHOLD } from "./tag.service";

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

async function loadFirstTitles(unitIds: readonly string[]) {
  if (unitIds.length === 0) return new Map<string, string>();
  const db = await getServerDb();
  const rows = await db
    .select({
      unitId: UnitTranslation.unitId,
      title: UnitTranslation.title,
    })
    .from(UnitTranslation)
    .where(inArray(UnitTranslation.unitId, [...unitIds]))
    .orderBy(asc(UnitTranslation.language));

  const titles = new Map<string, string>();
  for (const row of rows) {
    if (row.title && !titles.has(row.unitId)) {
      titles.set(row.unitId, row.title);
    }
  }
  return titles;
}

export async function getTagContext(
  unitId: string,
  userId?: string,
  options?: { includeBelowThreshold?: boolean },
) {
  const db = await getServerDb();
  // Get global tags for this unit, pin-first then score-desc.
  // Regular callers do not see rows at/below the visibility threshold.
  // 获取该 unit 的全局标签，先按置顶排序，再按 score 降序。
  // 普通调用方看不到处于或低于可见性阈值的行。
  const unitTags = await db
    .select()
    .from(UnitTag)
    .where(
      options?.includeBelowThreshold
        ? eq(UnitTag.unitId, unitId)
        : and(
            eq(UnitTag.unitId, unitId),
            gt(UnitTag.score, VISIBILITY_THRESHOLD),
          ),
    )
    .orderBy(
      desc(UnitTag.pinned),
      asc(UnitTag.position),
      desc(UnitTag.score),
      asc(UnitTag.tagUnitId),
    );
  const tagTitles = await loadFirstTitles(unitTags.map((ut) => ut.tagUnitId));
  const viewerTagVotes =
    userId && unitTags.length > 0
      ? await db
          .select({
            tagUnitId: TagVote.tagUnitId,
            value: TagVote.value,
          })
          .from(TagVote)
          .where(
            and(
              eq(TagVote.userId, userId),
              eq(TagVote.unitId, unitId),
              inArray(
                TagVote.tagUnitId,
                unitTags.map((ut) => ut.tagUnitId),
              ),
            ),
          )
      : [];
  const viewerTagVoteByTagUnitId = new Map(
    viewerTagVotes.map((vote) => [vote.tagUnitId, vote.value]),
  );

  const tags = unitTags.map((ut) => ({
    tagUnitId: ut.tagUnitId,
    score: ut.score,
    voteCount: ut.voteCount,
    viewerVote: viewerTagVoteByTagUnitId.get(ut.tagUnitId) ?? null,
    pinned: ut.pinned,
    position: ut.position,
    label: tagTitles.get(ut.tagUnitId) ?? ut.tagUnitId,
  }));

  let realmHighlights: {
    realmUnitId: string;
    realmName: string;
    tags: {
      tagUnitId: string;
      label: string;
      score: number;
      voteCount: number;
      viewerVote: number | null;
      contextUnitId: string | null;
    }[];
  }[] = [];

  if (userId) {
    // Get user's preferred realms (first 5 memberships)
    // 获取用户偏好的 realm（前 5 个成员关系）。
    const memberships = await db
      .select({ realmUnitId: RealmMember.realmUnitId })
      .from(RealmMember)
      .where(eq(RealmMember.userId, userId))
      .orderBy(desc(RealmMember.joinedAt))
      .limit(5);

    const realmIds = memberships.map((m) => m.realmUnitId);

    if (realmIds.length > 0) {
      const realmTagApplications = await db
        .select()
        .from(RealmTagApplication)
        .where(
          options?.includeBelowThreshold
            ? and(
                eq(RealmTagApplication.unitId, unitId),
                inArray(RealmTagApplication.realmUnitId, realmIds),
              )
            : and(
                eq(RealmTagApplication.unitId, unitId),
                inArray(RealmTagApplication.realmUnitId, realmIds),
                gt(RealmTagApplication.score, VISIBILITY_THRESHOLD),
              ),
        )
        .orderBy(
          desc(RealmTagApplication.pinned),
          asc(RealmTagApplication.position),
          desc(RealmTagApplication.score),
          asc(RealmTagApplication.tagUnitId),
        );

      const contextRows =
        realmTagApplications.length === 0
          ? []
          : await db
              .select({
                realmUnitId: RealmTagContext.realmUnitId,
                tagUnitId: RealmTagContext.tagUnitId,
                contextUnitId: RealmTagContext.contextUnitId,
              })
              .from(RealmTagContext)
              .where(
                inArray(
                  RealmTagContext.realmUnitId,
                  realmTagApplications.map((rtu) => rtu.realmUnitId),
                ),
              );

      const contextByPair = new Map(
        contextRows.map((row) => [
          `${row.realmUnitId}:${row.tagUnitId}`,
          row.contextUnitId,
        ]),
      );
      const viewerRealmVotes =
        realmTagApplications.length === 0
          ? []
          : await db
              .select({
                realmUnitId: RealmTagApplicationVote.realmUnitId,
                tagUnitId: RealmTagApplicationVote.tagUnitId,
                value: RealmTagApplicationVote.value,
              })
              .from(RealmTagApplicationVote)
              .where(
                and(
                  eq(RealmTagApplicationVote.userId, userId),
                  eq(RealmTagApplicationVote.unitId, unitId),
                  inArray(
                    RealmTagApplicationVote.realmUnitId,
                    realmTagApplications.map((rtu) => rtu.realmUnitId),
                  ),
                  inArray(
                    RealmTagApplicationVote.tagUnitId,
                    realmTagApplications.map((rtu) => rtu.tagUnitId),
                  ),
                ),
              );
      const viewerRealmVoteByPair = new Map(
        viewerRealmVotes.map((vote) => [
          `${vote.realmUnitId}:${vote.tagUnitId}`,
          vote.value,
        ]),
      );
      const [realmNames, appliedTagTitles] = await Promise.all([
        loadFirstTitles(realmIds),
        loadFirstTitles(realmTagApplications.map((rtu) => rtu.tagUnitId)),
      ]);

      const grouped = new Map<
        string,
        {
          realmName: string;
          tags: {
            tagUnitId: string;
            label: string;
            score: number;
            voteCount: number;
            viewerVote: number | null;
            contextUnitId: string | null;
          }[];
        }
      >();
      for (const rtu of realmTagApplications) {
        const key = rtu.realmUnitId;
        if (!grouped.has(key)) {
          grouped.set(key, {
            realmName: realmNames.get(key) ?? key,
            tags: [],
          });
        }
        grouped.get(key)!.tags.push({
          tagUnitId: rtu.tagUnitId,
          label: appliedTagTitles.get(rtu.tagUnitId) ?? rtu.tagUnitId,
          score: rtu.score,
          voteCount: rtu.voteCount,
          viewerVote:
            viewerRealmVoteByPair.get(`${rtu.realmUnitId}:${rtu.tagUnitId}`) ??
            null,
          contextUnitId:
            contextByPair.get(`${rtu.realmUnitId}:${rtu.tagUnitId}`) ?? null,
        });
      }

      realmHighlights = Array.from(grouped.entries()).map(
        ([realmUnitId, data]) => ({
          realmUnitId,
          ...data,
        }),
      );
    }
  }

  return { tags, realmHighlights };
}
