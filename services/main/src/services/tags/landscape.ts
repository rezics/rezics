export function selectRealmTagSources<
	Source extends { readonly realmId: string },
	VotedTag,
>(input: {
	readonly sources: readonly Source[];
	readonly votedTags: ReadonlyMap<string, VotedTag[]>;
	readonly canVoteRealmIds: ReadonlySet<string>;
	readonly limit: number;
}): (Source & {
	readonly canVote: boolean;
	readonly votedTags: VotedTag[];
})[] {
	return input.sources
		.flatMap((source) => {
			const votedTags = input.votedTags.get(source.realmId);
			return votedTags?.length
				? [
						{
							...source,
							canVote: input.canVoteRealmIds.has(source.realmId),
							votedTags,
						},
					]
				: [];
		})
		.slice(0, input.limit);
}
