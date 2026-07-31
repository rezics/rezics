/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { RealmScoreContextLink } from "./realm-score-context-link";

const state = vi.hoisted(() => ({
	contextPostId: null as string | null,
}));

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

vi.mock("@rezics/openapi-tanstack-query", () => ({
	useGetApiRealmsByRealmIdScoreContext: () => ({
		data: { contextPostId: state.contextPostId },
	}),
}));

vi.mock("@/features/application-shell/components/app-link", () => ({
	AppLink: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
		<a {...props}>{children}</a>
	),
}));

const translation = await create(resources).getTranslation(["engagement"], ["zh-Hant"]);

beforeEach(() => {
	state.contextPostId = null;
});

afterEach(cleanup);

describe("RealmScoreContextLink", () => {
	it("stays absent when the Realm has no scoring guidelines", () => {
		render(
			<TranslationProvider initial={translation.snapshot}>
				<RealmScoreContextLink realmId="realm-id" />
			</TranslationProvider>,
		);

		expect(screen.queryByRole("link")).toBeNull();
	});

	it("links the configured guidelines through the Realm presentation context", () => {
		state.contextPostId = "post/id";

		render(
			<TranslationProvider initial={translation.snapshot}>
				<RealmScoreContextLink realmId="realm/id" />
			</TranslationProvider>,
		);

		expect(screen.getByRole("link", { name: "查看評分準則" }).getAttribute("href")).toBe(
			"/posts/post%2Fid?realmId=realm%2Fid",
		);
	});
});
