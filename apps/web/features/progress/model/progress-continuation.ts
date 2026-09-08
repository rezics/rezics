import { bookReaderHref, unitDetailHref } from "@/features/units/routing/unit-detail-routes";

import type { ProgressContinuation, UnitProgressDomain } from "./progress-record";

export function defaultProgressContinuation(domain: UnitProgressDomain): ProgressContinuation {
	return (domain.type === "publishing" && domain.shape === "text_version") ||
		domain.type === "program"
		? { kind: "contents", unitId: domain.unitId, unitType: domain.type }
		: { kind: "none" };
}

export function parseProgressContinuation(
	value: unknown,
	domain: UnitProgressDomain,
): ProgressContinuation {
	if (!isRecord(value)) return defaultProgressContinuation(domain);
	const candidate = value;
	if (
		candidate.kind === "text-version-node" &&
		typeof candidate.textVersionId === "string" &&
		typeof candidate.nodeId === "string"
	)
		return {
			kind: "text-version-node",
			textVersionId: candidate.textVersionId,
			nodeId: candidate.nodeId,
		};
	if (candidate.kind === "unit" && isRecord(candidate.contentUnit)) {
		const contentUnit = candidate.contentUnit;
		if (
			typeof contentUnit.id === "string" &&
			(contentUnit.owner === "video" || contentUnit.owner === "audio")
		)
			return { kind: "unit", unitId: contentUnit.id, unitType: contentUnit.owner };
	}
	if (candidate.kind === "contents" && isRecord(candidate.ownerUnit)) {
		const ownerUnit = candidate.ownerUnit;
		if (
			typeof ownerUnit.id === "string" &&
			(ownerUnit.owner === "publishing" || ownerUnit.owner === "program")
		)
			return { kind: "contents", unitId: ownerUnit.id, unitType: ownerUnit.owner };
	}
	if (candidate.kind === "none") return { kind: "none" };
	return defaultProgressContinuation(domain);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return value !== null && typeof value === "object";
}

export function progressContinuationHref(continuation: ProgressContinuation): string | null {
	switch (continuation.kind) {
		case "text-version-node":
			return bookReaderHref(continuation.textVersionId, continuation.nodeId);
		case "unit":
			return `/units/${continuation.unitType}/${continuation.unitId}`;
		case "contents":
			return unitDetailHref(continuation.unitType, continuation.unitId, "contents");
		case "none":
			return null;
	}
}
