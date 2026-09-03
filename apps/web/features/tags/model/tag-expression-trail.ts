import type { RenderedTagExpression, TagExpressionRenderSource } from "./tag-expression-renderer";

export interface TagExpressionTrailSegment {
	readonly key: string;
	readonly label: string;
}

export type TagExpressionTrailSegments = readonly [
	TagExpressionTrailSegment,
	...TagExpressionTrailSegment[],
];

export interface TagExpressionTrail {
	readonly label: string;
	readonly segments: TagExpressionTrailSegments;
}

export type CompactTagExpressionTrailPart =
	| { readonly kind: "segment"; readonly segment: TagExpressionTrailSegment }
	| { readonly kind: "ellipsis"; readonly key: string };

function displaySegments(
	item: RenderedTagExpression,
	unknownLabel: string,
): TagExpressionTrailSegments {
	const [firstPart, ...remainingParts] = item.displayParts;
	if (!firstPart) return [{ key: `label:${item.key}`, label: item.label || unknownLabel }];
	const presentPart = (part: (typeof item.displayParts)[number]) => ({
		key: part.key,
		label: part.label.trim() || unknownLabel,
	});
	return [presentPart(firstPart), ...remainingParts.map((part) => presentPart(part))];
}

/**
 * Presents the active Expression presentation as a Path-styled badge trail.
 * Structural Path members remain source detail and never become display parts
 * unless the renderer explicitly selected one to repair a visible collision.
 */
export function presentTagExpressionTrail<Source extends TagExpressionRenderSource>(
	item: RenderedTagExpression<Source>,
	unknownLabel: string,
): TagExpressionTrail {
	const segments = displaySegments(item, unknownLabel);
	return {
		label: segments.map(({ label }) => label).join(" › "),
		segments,
	};
}

export function compactTagExpressionTrail(
	segments: TagExpressionTrailSegments,
	maximumParts: 3 | 4,
): readonly CompactTagExpressionTrailPart[] {
	if (segments.length <= maximumParts)
		return segments.map((segment) => ({ kind: "segment" as const, segment }));

	const first = segments[0];
	const tailCount = maximumParts - 2;
	return [
		{ kind: "segment", segment: first },
		{ kind: "ellipsis", key: `ellipsis:${first.key}` },
		...segments.slice(-tailCount).map((segment) => ({ kind: "segment" as const, segment })),
	];
}
