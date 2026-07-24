export function selectPopulatedRealmTagSources<
	Source extends { readonly realmId: string },
	VotedTag,
	PolicyTag,
>(input: {
	readonly sources: readonly Source[];
	readonly votedTags: ReadonlyMap<string, VotedTag[]>;
	readonly policyTags: ReadonlyMap<string, PolicyTag[]>;
	readonly limit: number;
}): (Source & {
	readonly votedTags: VotedTag[];
	readonly policyTags: PolicyTag[];
})[] {
	const populated = [];
	for (const source of input.sources) {
		const votedTags = input.votedTags.get(source.realmId) ?? [];
		const policyTags = input.policyTags.get(source.realmId) ?? [];
		if (!votedTags.length && !policyTags.length) continue;
		populated.push({ ...source, votedTags, policyTags });
		if (populated.length === input.limit) break;
	}
	return populated;
}
