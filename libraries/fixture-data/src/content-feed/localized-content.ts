export interface FeedFixtureLocalizedContent {
	readonly publishers: readonly [
		{
			readonly name: string;
			readonly initials: string;
			readonly summary: string;
		},
		{
			readonly name: string;
			readonly initials: string;
			readonly summary: string;
		},
		...{
			readonly name: string;
			readonly initials: string;
			readonly summary: string;
		}[],
	];
	readonly realms: readonly [
		{
			readonly name: string;
			readonly initials: string;
			readonly summary: string;
		},
		{
			readonly name: string;
			readonly initials: string;
			readonly summary: string;
		},
		...{
			readonly name: string;
			readonly initials: string;
			readonly summary: string;
		}[],
	];
	readonly post: {
		readonly title: string;
		readonly body: string;
		readonly mediaAlt: string;
	};
	readonly collection: {
		readonly title: string;
		readonly body: string;
		readonly coverAlt: string;
	};
}
