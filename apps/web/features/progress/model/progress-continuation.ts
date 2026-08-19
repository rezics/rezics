import { bookReaderHref, unitDetailHref } from "@/features/units/routing/unit-detail-routes";

import type { ProgressContinuation, UnitProgressDomain } from "./progress-record";

export function defaultProgressContinuation(domain: UnitProgressDomain): ProgressContinuation {
	return domain.type === "book" || domain.type === "media"
		? { kind: "contents", unitId: domain.unitId, unitType: domain.type }
		: { kind: "none" };
}

export function parseProgressContinuation(
	value: unknown,
	domain: UnitProgressDomain,
): ProgressContinuation {
	if (!value || typeof value !== "object") return defaultProgressContinuation(domain);
	const candidate = value as Readonly<Record<string, unknown>>;
	if (
		candidate.kind === "book-node" &&
		typeof candidate.bookId === "string" &&
		typeof candidate.nodeId === "string"
	)
		return { kind: "book-node", bookId: candidate.bookId, nodeId: candidate.nodeId };
	if (candidate.kind === "unit" && isRecord(candidate.contentUnit)) {
		const contentUnit = candidate.contentUnit;
		if (
			typeof contentUnit.id === "string" &&
			(contentUnit.type === "video" || contentUnit.type === "audio")
		)
			return { kind: "unit", unitId: contentUnit.id, unitType: contentUnit.type };
	}
	if (candidate.kind === "contents" && isRecord(candidate.ownerUnit)) {
		const ownerUnit = candidate.ownerUnit;
		if (
			typeof ownerUnit.id === "string" &&
			(ownerUnit.type === "book" || ownerUnit.type === "media")
		)
			return { kind: "contents", unitId: ownerUnit.id, unitType: ownerUnit.type };
	}
	if (candidate.kind === "none") return { kind: "none" };
	return defaultProgressContinuation(domain);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return value !== null && typeof value === "object";
}

export function progressContinuationHref(continuation: ProgressContinuation): string | null {
	switch (continuation.kind) {
		case "book-node":
			return bookReaderHref(continuation.bookId, continuation.nodeId);
		case "unit":
			return `/units/${continuation.unitType}/${continuation.unitId}`;
		case "contents":
			return unitDetailHref(continuation.unitType, continuation.unitId, "contents");
		case "none":
			return null;
	}
}
