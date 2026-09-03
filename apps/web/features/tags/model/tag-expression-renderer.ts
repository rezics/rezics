export type TagExpressionSemanticRole = "predicate" | "slot" | "value" | "focus" | "qualifier";

export interface TagExpressionLabelComponent {
	readonly tagId: string;
	readonly semanticRole: TagExpressionSemanticRole;
	readonly componentKind: "required" | "fallback";
	readonly title: string | null;
}

export interface TagExpressionPathMember {
	readonly nodeId: string;
	readonly nodeKind: "concept" | "guide";
	readonly title: string | null;
	readonly incomingRelation: { readonly relationKind: string } | null;
}

export type TagExpressionAuthority =
	| { readonly kind: "global" }
	| { readonly kind: "realm"; readonly realmId: string };

export interface TagExpressionRenderSource {
	readonly applicationId: string | null;
	readonly sourceKind: "definition" | "direct" | "path";
	readonly pathId: string | null;
	readonly members: readonly TagExpressionPathMember[];
}

export interface TagExpressionRenderInput<
	Source extends TagExpressionRenderSource = TagExpressionRenderSource,
> {
	readonly authority: TagExpressionAuthority;
	readonly expression: TagExpressionRenderDefinition;
	readonly applications: readonly Source[];
}

export interface TagExpressionRenderDefinition {
	readonly expressionId: string;
	readonly focusTagId: string;
	readonly components: readonly TagExpressionLabelComponent[];
	readonly groupKey: {
		readonly tagId: string;
		readonly semanticRole: TagExpressionSemanticRole;
		readonly title: string | null;
	} | null;
}

export interface TagExpressionRenderContext {
	readonly expressedComponents?: readonly {
		readonly tagId: string;
		readonly semanticRole: TagExpressionSemanticRole;
	}[];
	readonly groupByExpressionKey?: boolean;
	readonly authorityLabel?: (authority: TagExpressionAuthority) => string;
	readonly relationLabel?: (relationKind: string) => string;
	readonly unknownLabel: string;
	readonly separator?: string;
	readonly breadcrumbSeparator?: string;
	readonly maximumCollisionRepair?:
		| "presentation"
		| "path_ancestor"
		| "authority_relation"
		| "full_breadcrumb";
}

export interface RenderedTagExpressionDisplayPart {
	readonly key: string;
	readonly label: string;
	readonly source:
		| "component"
		| "path_ancestor"
		| "authority"
		| "relation"
		| "path_member"
		| "unknown";
}

export interface RenderedTagExpression<
	Source extends TagExpressionRenderSource = TagExpressionRenderSource,
> {
	readonly key: string;
	readonly authority: TagExpressionAuthority;
	readonly expressionId: string;
	readonly focusTagId: string;
	readonly label: string;
	readonly labelComponents: readonly TagExpressionLabelComponent[];
	readonly displayParts: readonly RenderedTagExpressionDisplayPart[];
	readonly applications: readonly Source[];
	readonly collisionRepair:
		| "none"
		| "restored_qualifier"
		| "fallback_qualifier"
		| "path_ancestor"
		| "authority_relation"
		| "full_breadcrumb";
}

export interface RenderedTagExpressionGroup<
	Source extends TagExpressionRenderSource = TagExpressionRenderSource,
> {
	readonly key: string;
	readonly groupKey: {
		readonly tagId: string;
		readonly semanticRole: TagExpressionSemanticRole;
		readonly title: string;
	} | null;
	readonly items: readonly RenderedTagExpression<Source>[];
}

type AggregatedInput<Source extends TagExpressionRenderSource> =
	TagExpressionRenderInput<Source> & { readonly key: string };

type LabelCandidate = {
	readonly label: string;
	readonly components: readonly TagExpressionLabelComponent[];
	readonly displayParts: readonly RenderedTagExpressionDisplayPart[];
	readonly repair: RenderedTagExpression["collisionRepair"];
};

const CollisionRepairRank = {
	none: 0,
	restored_qualifier: 0,
	fallback_qualifier: 0,
	path_ancestor: 1,
	authority_relation: 2,
	full_breadcrumb: 3,
} as const satisfies Readonly<Record<RenderedTagExpression["collisionRepair"], number>>;

const MaximumCollisionRepairRank = {
	presentation: 0,
	path_ancestor: 1,
	authority_relation: 2,
	full_breadcrumb: 3,
} as const satisfies Readonly<
	Record<NonNullable<TagExpressionRenderContext["maximumCollisionRepair"]>, number>
>;

function authorityKey(authority: TagExpressionAuthority): string {
	return authority.kind === "global" ? "global" : `realm:${authority.realmId}`;
}

function semanticKey(component: {
	readonly tagId: string;
	readonly semanticRole: TagExpressionSemanticRole;
}): string {
	return `${component.semanticRole}:${component.tagId}`;
}

function componentLabel(
	component: { readonly title: string | null },
	unknownLabel: string,
): string {
	return component.title?.trim() || unknownLabel;
}

function aggregateVisibleInputs<Source extends TagExpressionRenderSource>(
	inputs: readonly TagExpressionRenderInput<Source>[],
): readonly AggregatedInput<Source>[] {
	const groups = new Map<string, AggregatedInput<Source>>();
	for (const input of inputs) {
		if (!input.applications.length) continue;
		const key = `${authorityKey(input.authority)}:${input.expression.expressionId}`;
		const existing = groups.get(key);
		if (existing) {
			groups.set(key, {
				...existing,
				applications: [...existing.applications, ...input.applications],
			});
			continue;
		}
		groups.set(key, { ...input, key });
	}
	return [...groups.values()];
}

function requiredResidual(
	input: AggregatedInput<TagExpressionRenderSource>,
	contextKeys: ReadonlySet<string>,
): {
	readonly residual: readonly TagExpressionLabelComponent[];
	readonly omitted: readonly TagExpressionLabelComponent[];
} {
	const required = input.expression.components.filter(
		(component) => component.componentKind === "required",
	);
	const removable = required.filter((component) => contextKeys.has(semanticKey(component)));
	let residual = required.filter((component) => !contextKeys.has(semanticKey(component)));
	if (
		!residual.some(
			(component) => component.semanticRole === "focus" || component.semanticRole === "value",
		)
	) {
		const protectedComponent = [...required]
			.reverse()
			.find(
				(component) => component.semanticRole === "focus" || component.semanticRole === "value",
			);
		if (protectedComponent)
			residual = required.filter(
				(component) => !contextKeys.has(semanticKey(component)) || component === protectedComponent,
			);
	}
	return {
		residual,
		omitted: removable.filter((component) => !residual.includes(component)),
	};
}

function uniquePathAncestors(
	input: AggregatedInput<TagExpressionRenderSource>,
	existingTagIds: ReadonlySet<string>,
): readonly TagExpressionPathMember[] {
	const seen = new Set<string>();
	const result: TagExpressionPathMember[] = [];
	for (const source of input.applications) {
		for (const member of [...source.members].reverse()) {
			if (existingTagIds.has(member.nodeId) || seen.has(member.nodeId)) continue;
			seen.add(member.nodeId);
			result.push(member);
		}
	}
	return result;
}

function buildCandidates<Source extends TagExpressionRenderSource>(
	input: AggregatedInput<Source>,
	context: TagExpressionRenderContext,
	additionalContext: readonly {
		readonly tagId: string;
		readonly semanticRole: TagExpressionSemanticRole;
	}[],
): readonly LabelCandidate[] {
	const separator = context.separator ?? " · ";
	const breadcrumbSeparator = context.breadcrumbSeparator ?? " › ";
	const contextKeys = new Set(
		[...(context.expressedComponents ?? []), ...additionalContext].map(semanticKey),
	);
	const semantic = requiredResidual(
		input as AggregatedInput<TagExpressionRenderSource>,
		contextKeys,
	);
	const candidates: LabelCandidate[] = [];
	const maximumRepairRank =
		MaximumCollisionRepairRank[context.maximumCollisionRepair ?? "full_breadcrumb"];
	const add = (
		displayParts: readonly RenderedTagExpressionDisplayPart[],
		components: readonly TagExpressionLabelComponent[],
		repair: LabelCandidate["repair"],
		joiner = separator,
	) => {
		if (CollisionRepairRank[repair] > maximumRepairRank) return;
		const label = displayParts.map(({ label: partLabel }) => partLabel).join(joiner);
		if (label && !candidates.some((candidate) => candidate.label === label))
			candidates.push({ label, components, displayParts, repair });
	};
	const componentParts = (
		components: readonly TagExpressionLabelComponent[],
	): readonly RenderedTagExpressionDisplayPart[] =>
		components.map((component, index) => ({
			key: `component:${component.semanticRole}:${component.tagId}:${component.componentKind}:${index}`,
			label: componentLabel(component, context.unknownLabel),
			source: "component",
		}));
	add(componentParts(semantic.residual), semantic.residual, "none");
	for (let count = 1; count <= semantic.omitted.length; count += 1) {
		const restoredKeys = new Set(
			semantic.omitted.slice(-count).map((component) => semanticKey(component)),
		);
		const restored = input.expression.components.filter(
			(component) =>
				component.componentKind === "required" &&
				(semantic.residual.includes(component) || restoredKeys.has(semanticKey(component))),
		);
		add(componentParts(restored), restored, "restored_qualifier");
	}
	const fallback = input.expression.components.filter(
		(component) => component.componentKind === "fallback",
	);
	for (let count = 1; count <= fallback.length; count += 1) {
		const fallbackKeys = new Set(fallback.slice(0, count).map(semanticKey));
		const withFallback = input.expression.components.filter(
			(component) =>
				semantic.residual.includes(component) ||
				(component.componentKind === "fallback" && fallbackKeys.has(semanticKey(component))),
		);
		add(componentParts(withFallback), withFallback, "fallback_qualifier");
	}
	const expressionTagIds = new Set(input.expression.components.map((component) => component.tagId));
	for (const ancestor of uniquePathAncestors(
		input as AggregatedInput<TagExpressionRenderSource>,
		expressionTagIds,
	))
		add(
			[
				{
					key: `path-ancestor:${ancestor.nodeId}`,
					label: componentLabel(ancestor, context.unknownLabel),
					source: "path_ancestor",
				},
				...componentParts(semantic.residual),
			],
			semantic.residual,
			"path_ancestor",
		);
	const relationKind = input.applications
		.flatMap((source) => source.members)
		.findLast((member) => member.incomingRelation)?.incomingRelation?.relationKind;
	const authority = context.authorityLabel?.(input.authority);
	const relation = relationKind ? context.relationLabel?.(relationKind) : undefined;
	if (authority || relation)
		add(
			[
				...(authority
					? [
							{
								key: `authority:${authorityKey(input.authority)}`,
								label: authority,
								source: "authority" as const,
							},
						]
					: []),
				...(relation && relationKind
					? [
							{
								key: `relation:${relationKind}`,
								label: relation,
								source: "relation" as const,
							},
						]
					: []),
				...componentParts(semantic.residual),
			],
			semantic.residual,
			"authority_relation",
		);
	for (const source of input.applications) {
		if (!source.members.length) continue;
		add(
			source.members.map((member, index) => ({
				key: `path-member:${member.nodeId}:${index}`,
				label: componentLabel(member, context.unknownLabel),
				source: "path_member",
			})),
			semantic.residual,
			"full_breadcrumb",
			breadcrumbSeparator,
		);
	}
	if (!candidates.length)
		candidates.push({
			label: context.unknownLabel,
			components: [],
			displayParts: [
				{ key: `unknown:${input.key}`, label: context.unknownLabel, source: "unknown" },
			],
			repair: "none",
		});
	return candidates;
}

function chooseUniqueCandidates(
	candidates: readonly (readonly LabelCandidate[])[],
): readonly LabelCandidate[] {
	const selected = candidates.map(() => 0);
	while (true) {
		const labels = new Map<string, number[]>();
		for (let index = 0; index < candidates.length; index += 1) {
			const label = candidates[index]![selected[index]!]!.label;
			const matches = labels.get(label) ?? [];
			matches.push(index);
			labels.set(label, matches);
		}
		let progressed = false;
		for (const indexes of labels.values()) {
			if (indexes.length < 2) continue;
			for (const index of indexes) {
				if (selected[index]! + 1 >= candidates[index]!.length) continue;
				selected[index] = selected[index]! + 1;
				progressed = true;
			}
		}
		if (!progressed) break;
	}
	return candidates.map((options, index) => options[selected[index]!]!);
}

/**
 * Produces temporary UI labels from immutable Expression definitions. Labels
 * are never identities: aggregation occurs first, and collision repair never
 * merges distinct Expressions merely because their text happens to match.
 */
export function renderTagExpressions<Source extends TagExpressionRenderSource>(
	inputs: readonly TagExpressionRenderInput<Source>[],
	context: TagExpressionRenderContext,
): readonly RenderedTagExpressionGroup<Source>[] {
	const aggregated = aggregateVisibleInputs(inputs);
	const buckets = new Map<
		string,
		{
			readonly groupKey: RenderedTagExpressionGroup<Source>["groupKey"];
			readonly inputs: AggregatedInput<Source>[];
		}
	>();
	for (const input of aggregated) {
		const declaredGroup = context.groupByExpressionKey ? input.expression.groupKey : null;
		const key = declaredGroup ? semanticKey(declaredGroup) : "ungrouped";
		const bucket = buckets.get(key);
		if (bucket) bucket.inputs.push(input);
		else
			buckets.set(key, {
				groupKey: declaredGroup
					? {
							tagId: declaredGroup.tagId,
							semanticRole: declaredGroup.semanticRole,
							title: componentLabel(declaredGroup, context.unknownLabel),
						}
					: null,
				inputs: [input],
			});
	}
	return [...buckets.entries()].map(([key, bucket]) => {
		const groupContext = bucket.groupKey
			? [
					{
						tagId: bucket.groupKey.tagId,
						semanticRole: bucket.groupKey.semanticRole,
					},
				]
			: [];
		const candidateSets = bucket.inputs.map((input) =>
			buildCandidates(input, context, groupContext),
		);
		const selected = chooseUniqueCandidates(candidateSets);
		return {
			key,
			groupKey: bucket.groupKey,
			items: bucket.inputs.map((input, index) => ({
				key: input.key,
				authority: input.authority,
				expressionId: input.expression.expressionId,
				focusTagId: input.expression.focusTagId,
				label: selected[index]!.label,
				labelComponents: selected[index]!.components,
				displayParts: selected[index]!.displayParts,
				applications: input.applications,
				collisionRepair: selected[index]!.repair,
			})),
		};
	});
}
