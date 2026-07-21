export interface FeedFixtureLocalizedContent {
	readonly publisher: {
		readonly name: string;
		readonly initials: string;
	};
	readonly realm: {
		readonly name: string;
		readonly initials: string;
	};
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
