export type FeedDisplayContext =
	| Readonly<{ kind: "unscoped" }>
	| Readonly<{ kind: "unit"; unitId: string }>;

export const UnscopedFeedDisplayContext = {
	kind: "unscoped",
} as const satisfies FeedDisplayContext;

export function isCurrentFeedSubject(
	context: FeedDisplayContext,
	subjectId: string | null | undefined,
): boolean {
	return context.kind === "unit" && subjectId === context.unitId;
}
