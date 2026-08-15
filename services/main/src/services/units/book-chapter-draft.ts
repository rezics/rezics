import { and, eq, inArray, isNull } from "drizzle-orm";

import { database, type DatabaseTransaction } from "../database";
import { book, bookChapterDraftJob, contentStructure, unit } from "../database/schema";
import { UnitChanged, UnitNotFound } from "./errors";

export type BookChapterDraftJobSummary = {
	readonly id: string;
	readonly state: "pending" | "completed";
};

type EnqueueBookChapterDraftJobInput = {
	readonly bookId: string;
	readonly bookUpdatedAt: Date;
	readonly requestedByProfileId: string;
};

/** Creates or reuses the durable Chapter-drafting command inside its Book transaction. @internal */
export async function enqueueBookChapterDraftJobInTransaction(
	tx: DatabaseTransaction,
	input: EnqueueBookChapterDraftJobInput,
): Promise<BookChapterDraftJobSummary> {
	const [current] = await tx
		.select({
			id: book.id,
			status: unit.status,
			updatedAt: unit.updatedAt,
			structureId: contentStructure.id,
		})
		.from(book)
		.innerJoin(unit, eq(unit.id, book.id))
		.leftJoin(
			contentStructure,
			and(
				eq(contentStructure.ownerUnitId, book.id),
				eq(contentStructure.kind, "book.contents"),
				isNull(contentStructure.deletedAt),
			),
		)
		.where(and(eq(book.id, input.bookId), isNull(unit.deletedAt)))
		.limit(1)
		.for("update", { of: unit });
	if (!current) throw new UnitNotFound("book");
	if (current.status !== "draft" || current.updatedAt.getTime() !== input.bookUpdatedAt.getTime())
		throw new UnitChanged(current.updatedAt);

	const [active] = await tx
		.select({
			id: bookChapterDraftJob.id,
			bookUpdatedAt: bookChapterDraftJob.bookUpdatedAt,
			requestedByProfileId: bookChapterDraftJob.requestedByProfileId,
		})
		.from(bookChapterDraftJob)
		.where(
			and(
				eq(bookChapterDraftJob.bookId, input.bookId),
				inArray(bookChapterDraftJob.state, ["pending", "processing", "retry_wait"]),
			),
		)
		.limit(1)
		.for("update");
	if (
		active?.bookUpdatedAt.getTime() === input.bookUpdatedAt.getTime() &&
		active.requestedByProfileId === input.requestedByProfileId
	)
		return { id: active.id, state: "pending" };
	if (active) await cancelBookChapterDraftJobs(tx, input.bookId);

	const completed = current.structureId === null;
	const [created] = await tx
		.insert(bookChapterDraftJob)
		.values({
			bookId: input.bookId,
			bookUpdatedAt: current.updatedAt,
			requestedByProfileId: input.requestedByProfileId,
			structureId: current.structureId,
			state: completed ? "completed" : "pending",
			...(completed ? { completedAt: new Date() } : {}),
		})
		.returning({ id: bookChapterDraftJob.id });
	if (!created) throw new Error("Book Chapter draft job insertion returned no row");
	return { id: created.id, state: completed ? "completed" : "pending" };
}

/** Creates or reuses the durable Chapter-drafting command for one exact Book version. */
export async function enqueueBookChapterDraftJob(
	input: EnqueueBookChapterDraftJobInput,
): Promise<BookChapterDraftJobSummary> {
	return database.transaction((tx) => enqueueBookChapterDraftJobInTransaction(tx, input));
}

/** Cancels outstanding Chapter drafting when a later Book lifecycle decision supersedes it. */
export async function cancelBookChapterDraftJobs(
	tx: DatabaseTransaction,
	bookId: string,
): Promise<void> {
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
		.where(
			and(
				eq(bookChapterDraftJob.bookId, bookId),
				inArray(bookChapterDraftJob.state, ["pending", "processing", "retry_wait"]),
			),
		);
}
