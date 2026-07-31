/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { RealmScoreContextCard } from "./realm-score-context-card";

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
		error: null,
		isError: false,
		isPending: false,
	}),
}));

vi.mock("@/features/application-shell/components/app-link", () => ({
	AppLink: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
		<a {...props}>{children}</a>
	),
}));

const translation = await create(resources).getTranslation(["engagement", "realms"], ["zh-Hant"]);

beforeEach(() => {
	state.contextPostId = null;
});

afterEach(cleanup);

describe("RealmScoreContextCard", () => {
	it("stays absent when the Realm has no scoring guidelines", () => {
		const view = render(
			<TranslationProvider initial={translation.snapshot}>
				<RealmScoreContextCard canManage realm={{ id: "realm/id" }} />
			</TranslationProvider>,
		);

		expect(view.container.textContent).toBe("");
	});

	it("links configured guidelines without exposing manager controls to readers", () => {
		state.contextPostId = "post/id";

		render(
			<TranslationProvider initial={translation.snapshot}>
				<RealmScoreContextCard canManage={false} realm={{ id: "realm/id" }} />
			</TranslationProvider>,
		);

		expect(screen.getByRole("link", { name: "查看評分準則" }).getAttribute("href")).toBe(
			"/posts/post%2Fid?realmId=realm%2Fid",
		);
		expect(screen.queryByRole("link", { name: "領域設定" })).toBeNull();
	});

	it("keeps the settings entry with configured guidelines for managers", () => {
		state.contextPostId = "post/id";

		render(
			<TranslationProvider initial={translation.snapshot}>
				<RealmScoreContextCard canManage realm={{ id: "realm/id" }} />
			</TranslationProvider>,
		);

		expect(screen.getByRole("link", { name: "領域設定" }).getAttribute("href")).toBe(
			"/realm/realm%2Fid/settings/scoring",
		);
	});
});
