import { t } from "elysia";

import type { ContentReviewCaseStateValues } from "../../database/schema";
import { parseJsonCursor } from "../../pagination";
import { InvalidPaginationCursor } from "../../pagination/errors";
import type { MyReportStatus } from "./schema";

const MyReportCursor = t.Object(
	{
		v: t.Literal(1),
		createdAt: t.String({ format: "date-time" }),
		id: t.String({ format: "uuid" }),
	},
	{ additionalProperties: false },
);

export interface MyReportCursorBoundary {
	readonly createdAt: Date;
	readonly id: string;
}

export function decodeMyReportCursor(
	value: string | undefined,
): MyReportCursorBoundary | undefined {
	if (!value) return undefined;
	try {
		const cursor = parseJsonCursor(value, MyReportCursor);
		const createdAt = new Date(cursor.createdAt);
		if (Number.isNaN(createdAt.getTime())) throw new InvalidPaginationCursor();
		return { createdAt, id: cursor.id };
	} catch {
		throw new InvalidPaginationCursor();
	}
}

export function encodeMyReportCursor(boundary: MyReportCursorBoundary): string {
	return Buffer.from(
		JSON.stringify({
			v: 1,
			createdAt: boundary.createdAt.toISOString(),
			id: boundary.id,
		}),
	).toString("base64url");
}

type ContentReviewCaseState = (typeof ContentReviewCaseStateValues)[number];

export function toMyReportStatus(state: ContentReviewCaseState): MyReportStatus {
	switch (state) {
		case "new":
			return "submitted";
		case "triaged":
		case "assigned":
		case "escalated":
		case "reviewing":
			return "reviewing";
		case "actioned":
		case "resolved":
			return "completed";
		case "duplicate":
			return "merged";
		case "rejected":
			return "not_actioned";
		default:
			return state satisfies never;
	}
}

export function toAggregateMyReportStatus(
	states: readonly ContentReviewCaseState[],
): MyReportStatus {
	const statuses = states.map(toMyReportStatus);
	if (statuses.some((status) => status === "reviewing")) return "reviewing";
	if (statuses.some((status) => status === "submitted")) return "submitted";
	if (statuses.some((status) => status === "completed")) return "completed";
	if (statuses.every((status) => status === "merged")) return "merged";
	return "not_actioned";
}
