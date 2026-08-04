/** @vitest-environment jsdom */

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	getPublisherUnitIds,
	ReplyAttributionLinks,
	type AttributionSummary,
} from "./attribution-list";

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({ t: { units: { attributionRoles: {} } } }),
}));

afterEach(cleanup);

function createAttribution({
	creditedUnitId,
	creditId,
	role = "publisher",
	title,
}: {
	readonly creditedUnitId: string;
	readonly creditId: string;
	readonly role?: string;
	readonly title: string;
}): AttributionSummary {
	return {
		id: creditId,
		role,
		creditedUnit: {
			id: creditedUnitId,
			kind: "slug_namespace",
			title,
		},
	};
}

describe("ReplyAttributionLinks", () => {
	it("derives displayed-Post publisher identities without including other credit roles", () => {
		const publisher = createAttribution({
			creditedUnitId: "post-publisher",
			creditId: "publisher-credit",
			title: "Publisher",
		});
		const author = createAttribution({
			creditedUnitId: "post-author",
			creditId: "author-credit",
			role: "author",
			title: "Author",
		});

		expect([...getPublisherUnitIds([publisher, author])]).toEqual(["post-publisher"]);
	});

	it("labels only reply identities credited as publishers on the displayed Post", () => {
		const { container } = render(
			<ReplyAttributionLinks
				attributions={[
					createAttribution({
						creditedUnitId: "post-publisher",
						creditId: "owner-reply-credit",
						title: "Post owner",
					}),
					createAttribution({
						creditedUnitId: "other-publisher",
						creditId: "visitor-reply-credit",
						title: "Visitor",
					}),
				]}
				emptyLabel="Unknown"
				postPublisherUnitIds={new Set(["post-publisher"])}
				publisherLabel="Publisher"
			/>,
		);

		expect(container.textContent).toBe("Post owner (Publisher), Visitor");
	});

	it("matches immutable credited Unit identity rather than role or visible name", () => {
		const { container } = render(
			<ReplyAttributionLinks
				attributions={[
					createAttribution({
						creditedUnitId: "post-publisher",
						creditId: "matching-author-credit",
						role: "author",
						title: "Same name",
					}),
					createAttribution({
						creditedUnitId: "different-unit",
						creditId: "nonmatching-publisher-credit",
						title: "Same name",
					}),
				]}
				emptyLabel="Unknown"
				postPublisherUnitIds={new Set(["post-publisher"])}
				publisherLabel="Publisher"
			/>,
		);

		expect(container.textContent).toBe("Same name (Publisher), Same name");
	});

	it("keeps the empty attribution state free of a publisher label", () => {
		const { container } = render(
			<ReplyAttributionLinks
				attributions={[]}
				emptyLabel="Unknown"
				postPublisherUnitIds={new Set(["post-publisher"])}
				publisherLabel="Publisher"
			/>,
		);

		expect(container.textContent).toBe("Unknown");
	});
});
