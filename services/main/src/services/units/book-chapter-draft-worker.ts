import { and, asc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";

import { getUnitPermissionCondition } from "../authorization/unit/query";
import { database } from "../database";
import { bookChapterDraftJob, contentStructureNode, post, unit } from "../database/schema";
import { transitionUnitStatus } from "./status";
import {
	bookChapterDraftRetryDelayMilliseconds,
	BookChapterDraftPolicyV1,
	shouldDraftBookChapter,
} from "./book-chapter-draft-policy";

type ClaimedJob = {
	readonly id: string;
	readonly leaseToken: string;
};

async function claimJobs(now = new Date()): Promise<ClaimedJob[]> {
	return database.transaction(async (tx) => {
		const rows = await tx
			.select({ id: bookChapterDraftJob.id })
			.from(bookChapterDraftJob)
			.where(
				or(
					and(
						inArray(bookChapterDraftJob.state, ["pending", "retry_wait"]),
						lte(bookChapterDraftJob.availableAt, now),
					),
					and(
						eq(bookChapterDraftJob.state, "processing"),
						lte(bookChapterDraftJob.leaseExpiresAt, now),
					),
				),
			)
			.orderBy(asc(bookChapterDraftJob.availableAt), asc(bookChapterDraftJob.id))
			.limit(BookChapterDraftPolicyV1.claimBatchSize)
			.for("update", { skipLocked: true });
		if (!rows.length) return [];
		const claimed = await tx
			.update(bookChapterDraftJob)
			.set({
				state: "processing",
				leaseToken: sql`uuidv7()`,
				leaseExpiresAt: new Date(
					now.getTime() + BookChapterDraftPolicyV1.leaseDurationMilliseconds,
				),
				updatedAt: now,
			})
			.where(
				inArray(
					bookChapterDraftJob.id,
					rows.map(({ id }) => id),
				),
			)
			.returning({ id: bookChapterDraftJob.id, leaseToken: bookChapterDraftJob.leaseToken });
		return claimed.map((job) => {
			if (!job.leaseToken) throw new Error(`Claimed Book Chapter draft job ${job.id} has no lease`);
			return { id: job.id, leaseToken: job.leaseToken };
		});
	});
}

async function processBatch(claimed: ClaimedJob): Promise<void> {
	await database.transaction(async (tx) => {
		const [job] = await tx
			.select({
				id: bookChapterDraftJob.id,
				bookId: bookChapterDraftJob.bookId,
				structureId: bookChapterDraftJob.structureId,
				requestedByProfileId: bookChapterDraftJob.requestedByProfileId,
				cursorNodeId: bookChapterDraftJob.cursorNodeId,
				createdAt: bookChapterDraftJob.createdAt,
			})
			.from(bookChapterDraftJob)
			.where(
				and(
					eq(bookChapterDraftJob.id, claimed.id),
					eq(bookChapterDraftJob.state, "processing"),
					eq(bookChapterDraftJob.leaseToken, claimed.leaseToken),
				),
			)
			.limit(1)
			.for("update");
		if (!job) return;
		const [bookState] = await tx
			.select({ status: unit.status })
			.from(unit)
			.where(and(eq(unit.id, job.bookId), isNull(unit.deletedAt)))
			.limit(1);
		if (bookState?.status !== "draft") {
			const now = new Date();
			await tx
				.update(bookChapterDraftJob)
				.set({
					state: "cancelled",
					leaseToken: null,
					leaseExpiresAt: null,
					cancelledAt: now,
					updatedAt: now,
				})
				.where(eq(bookChapterDraftJob.id, job.id));
			return;
		}
		if (!job.structureId) throw new Error(`Book Chapter draft job ${job.id} has no structure`);

		const nodes = await tx
			.select({ id: contentStructureNode.id, chapterId: contentStructureNode.contentUnitId })
			.from(contentStructureNode)
			.innerJoin(post, eq(post.id, contentStructureNode.contentUnitId))
			.where(
				and(
					eq(contentStructureNode.structureId, job.structureId),
					eq(post.kind, "chapter"),
					isNull(contentStructureNode.deletedAt),
					lte(contentStructureNode.createdAt, job.createdAt),
					lte(contentStructureNode.updatedAt, job.createdAt),
					job.cursorNodeId ? gt(contentStructureNode.id, job.cursorNodeId) : undefined,
				),
			)
			.orderBy(asc(contentStructureNode.id))
			.limit(BookChapterDraftPolicyV1.chapterBatchSize);

		let drafted = 0;
		let skipped = 0;
		const chapters = nodes.length
			? await tx
					.select({
						id: unit.id,
						status: unit.status,
						allowed: sql<boolean>`${getUnitPermissionCondition(
							job.requestedByProfileId,
							"unit.status.update",
							["unit"],
						)}`,
					})
					.from(unit)
					.where(
						and(
							inArray(
								unit.id,
								nodes.map(({ chapterId }) => chapterId),
							),
							isNull(unit.deletedAt),
						),
					)
			: [];
		const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
		for (const node of nodes) {
			const chapter = chapterById.get(node.chapterId);
			if (!chapter || !shouldDraftBookChapter(chapter.status, chapter.allowed)) {
				skipped += 1;
				continue;
			}
			const result = await transitionUnitStatus(tx, {
				unitId: chapter.id,
				toStatus: "draft",
				actor: { kind: "profile", profileId: job.requestedByProfileId },
				authorization: { kind: "interactive", statusUpdateAllowed: true },
			});
			if (result.changed) drafted += 1;
			else skipped += 1;
		}

		const completed = nodes.length < BookChapterDraftPolicyV1.chapterBatchSize;
		const now = new Date();
		await tx
			.update(bookChapterDraftJob)
			.set({
				state: completed ? "completed" : "pending",
				cursorNodeId: nodes.at(-1)?.id ?? job.cursorNodeId,
				processedNodeCount: sql`${bookChapterDraftJob.processedNodeCount} + ${nodes.length}`,
				draftedChapterCount: sql`${bookChapterDraftJob.draftedChapterCount} + ${drafted}`,
				skippedChapterCount: sql`${bookChapterDraftJob.skippedChapterCount} + ${skipped}`,
				attemptCount: 0,
				availableAt: now,
				leaseToken: null,
				leaseExpiresAt: null,
				lastErrorMessage: null,
				...(completed ? { completedAt: now } : {}),
				updatedAt: now,
			})
			.where(
				and(
					eq(bookChapterDraftJob.id, job.id),
					eq(bookChapterDraftJob.leaseToken, claimed.leaseToken),
				),
			);
	});
}

async function markFailure(claimed: ClaimedJob, error: unknown): Promise<void> {
	const now = new Date();
	await database.transaction(async (tx) => {
		const [job] = await tx
			.select({ attemptCount: bookChapterDraftJob.attemptCount })
			.from(bookChapterDraftJob)
			.where(
				and(
					eq(bookChapterDraftJob.id, claimed.id),
					eq(bookChapterDraftJob.state, "processing"),
					eq(bookChapterDraftJob.leaseToken, claimed.leaseToken),
				),
			)
			.limit(1)
			.for("update");
		if (!job) return;
		const attemptCount = job.attemptCount + 1;
		const failed = attemptCount >= BookChapterDraftPolicyV1.maximumAttempts;
		await tx
			.update(bookChapterDraftJob)
			.set({
				state: failed ? "failed" : "retry_wait",
				attemptCount,
				availableAt: new Date(now.getTime() + bookChapterDraftRetryDelayMilliseconds(attemptCount)),
				leaseToken: null,
				leaseExpiresAt: null,
				lastErrorMessage: (error instanceof Error ? error.message : String(error)).slice(0, 2_000),
				...(failed ? { failedAt: now } : {}),
				updatedAt: now,
			})
			.where(eq(bookChapterDraftJob.id, claimed.id));
	});
}

/** Claims and advances a bounded set of Book Chapter draft jobs. */
export async function dispatchBookChapterDraftJobs(): Promise<number> {
	const jobs = await claimJobs();
	await Promise.all(
		jobs.map(async (job) => {
			try {
				await processBatch(job);
			} catch (error) {
				await markFailure(job, error);
			}
		}),
	);
	return jobs.length;
}
