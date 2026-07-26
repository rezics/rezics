/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiFeedListProps } from "@/features/content-feed/data/api-feed-list";
import { RealmFeed } from "./realm-feed";

vi.mock("nuqs", () => ({
	useQueryState: (key: string) => [key === "sort" ? "best" : [], vi.fn()],
}));

vi.mock("@/features/content-feed/data/api-feed-list", () => ({
	ApiFeedList: (props: ApiFeedListProps) => (
		<div
			data-content-filter={String(Boolean(props.onContentKindsChange))}
			data-language-filter={String(Boolean(props.onLanguagesChange))}
			data-realm-filter={String(Boolean(props.onRealmIdsChange))}
			data-realm-ids={props.realmIds?.join(",")}
			data-sort-filter={String(Boolean(props.onSortChange))}
			data-tag-filter={String(Boolean(props.onTagIdsChange))}
			data-testid="realm-feed"
		/>
	),
}));

afterEach(cleanup);

describe("RealmFeed", () => {
	it("fixes the Realm scope while exposing every other Feed control", () => {
		render(<RealmFeed realmId="realm-1" />);

		const feed = screen.getByTestId("realm-feed");
		expect(feed.getAttribute("data-realm-ids")).toBe("realm-1");
		expect(feed.getAttribute("data-realm-filter")).toBe("false");
		expect(feed.getAttribute("data-language-filter")).toBe("true");
		expect(feed.getAttribute("data-tag-filter")).toBe("true");
		expect(feed.getAttribute("data-sort-filter")).toBe("true");
		expect(feed.getAttribute("data-content-filter")).toBe("true");
	});
});
