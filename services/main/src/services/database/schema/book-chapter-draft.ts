import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	index,
	integer,
	pgEnum,
	text,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	createCreatedAtColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import { contentStructure } from "./content-structure";
import { profile } from "./profile";
import { book } from "./book";

export const bookChapterDraftJobState = pgEnum("book_chapter_draft_job_state", [
	"pending",
	"processing",
	"retry_wait",
	"completed",
	"cancelled",
	"failed",
]);

/** Durable, resumable request to draft Chapters attached to one Book structure. */
export const bookChapterDraftJob = pgTable(
	"book_chapter_draft_job",
	{
		id: createUuidv7PrimaryKey(),
		bookId: uuid()
			.notNull()
			.references(() => book.id, { onDelete: "restrict" }),
		structureId: uuid().references(() => contentStructure.id, { onDelete: "restrict" }),
		requestedByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		bookUpdatedAt: createTimestampMsColumn().notNull(),
		state: bookChapterDraftJobState().default("pending").notNull(),
		cursorNodeId: uuid(),
		processedNodeCount: bigint({ mode: "number" }).default(0).notNull(),
		draftedChapterCount: bigint({ mode: "number" }).default(0).notNull(),
		skippedChapterCount: bigint({ mode: "number" }).default(0).notNull(),
		attemptCount: integer().default(0).notNull(),
		availableAt: createTimestampMsColumn().defaultNow().notNull(),
		leaseToken: uuid(),
		leaseExpiresAt: createTimestampMsColumn(),
		lastErrorMessage: text(),
		completedAt: createTimestampMsColumn(),
		cancelledAt: createTimestampMsColumn(),
		failedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		uniqueIndex("book_chapter_draft_job_active_book_key")
			.on(table.bookId)
			.where(sql`${table.state} in ('pending', 'processing', 'retry_wait')`),
		index("book_chapter_draft_job_claim_idx")
			.on(table.availableAt, table.createdAt, table.id)
			.where(sql`${table.state} in ('pending', 'retry_wait')`),
		index("book_chapter_draft_job_lease_idx")
			.on(table.leaseExpiresAt, table.id)
			.where(sql`${table.state} = 'processing'`),
		index("book_chapter_draft_job_book_created_idx").on(
			table.bookId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		check("book_chapter_draft_job_processed_count_check", sql`${table.processedNodeCount} >= 0`),
		check("book_chapter_draft_job_drafted_count_check", sql`${table.draftedChapterCount} >= 0`),
		check("book_chapter_draft_job_skipped_count_check", sql`${table.skippedChapterCount} >= 0`),
		check("book_chapter_draft_job_attempt_count_check", sql`${table.attemptCount} >= 0`),
		check(
			"book_chapter_draft_job_lease_shape_check",
			sql`(${table.state} = 'processing') = (${table.leaseToken} is not null and ${table.leaseExpiresAt} is not null)`,
		),
	],
);
