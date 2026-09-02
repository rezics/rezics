import type {
	RenderedTagExpression,
	TagExpressionPathMember,
	TagExpressionRenderSource,
} from "./tag-expression-renderer";

export interface TagExpressionTrailSegment {
	readonly key: string;
	readonly label: string;
}

export type TagExpressionTrailSegments = readonly [
	TagExpressionTrailSegment,
	...TagExpressionTrailSegment[],
];

export interface TagExpressionTrail {
	readonly kind: "path" | "semantic";
	readonly label: string;
	readonly segments: TagExpressionTrailSegments;
}

export type CompactTagExpressionTrailPart =
	| { readonly kind: "segment"; readonly segment: TagExpressionTrailSegment }
	| { readonly kind: "ellipsis"; readonly key: string };

function sourcePathIdentity(source: TagExpressionRenderSource): string | null {
	if (source.sourceKind !== "path" || !source.members.length) return null;
	if (source.pathId) return `path:${source.pathId}`;
	return `members:${source.members
		.map((member) => `${member.nodeId}:${member.incomingRelation?.relationKind ?? "root"}`)
		.join("/")}`;
}

function pathSegments(
	item: RenderedTagExpression,
	unknownLabel: string,
): TagExpressionTrailSegments | null {
	const identities = item.applications.map(sourcePathIdentity);
	const identity = identities[0];
	if (!identity || identities.some((candidate) => candidate !== identity)) return null;
	const source = item.applications[0];
	const [firstMember, ...remainingMembers] = source?.members ?? [];
	if (!firstMember) return null;
	const presentMember = (member: TagExpressionPathMember, index: number) => ({
		key: `${member.nodeId}:${index}`,
		label: member.title?.trim() || unknownLabel,
	});
	return [
		presentMember(firstMember, 0),
		...remainingMembers.map((member, index) => presentMember(member, index + 1)),
	];
}

function semanticSegments(
	item: RenderedTagExpression,
	unknownLabel: string,
): TagExpressionTrailSegments {
	if (
		item.collisionRepair === "path_ancestor" ||
		item.collisionRepair === "authority_relation" ||
		item.collisionRepair === "full_breadcrumb" ||
		!item.labelComponents.length
	)
		return [{ key: `label:${item.key}`, label: item.label || unknownLabel }];

	const [firstComponent, ...remainingComponents] = item.labelComponents;
	if (!firstComponent) return [{ key: `label:${item.key}`, label: item.label || unknownLabel }];
	const presentComponent = (component: (typeof item.labelComponents)[number], index: number) => ({
		key: `${component.semanticRole}:${component.tagId}:${index}`,
		label: component.title?.trim() || unknownLabel,
	});
	return [
		presentComponent(firstComponent, 0),
		...remainingComponents.map((component, index) => presentComponent(component, index + 1)),
	];
}

/**
 * Presents one aggregated Expression as a stable trail. A source Path is only
 * exposed when every application resolves to the same Path identity; mixed or
 * conflicting sources retain the renderer's collision-safe semantic label.
 */
export function presentTagExpressionTrail<Source extends TagExpressionRenderSource>(
	item: RenderedTagExpression<Source>,
	unknownLabel: string,
): TagExpressionTrail {
	const path = pathSegments(item, unknownLabel);
	if (path)
		return {
			kind: "path",
			label: path.map(({ label }) => label).join(" › "),
			segments: path,
		};

	const semantic = semanticSegments(item, unknownLabel);
	return {
		kind: "semantic",
		label: item.label || semantic.map(({ label }) => label).join(" · "),
		segments: semantic,
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
