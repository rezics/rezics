/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { RealmPolicyTagDialog } from "./realm-policy-tag-dialog";

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

vi.mock("@/i18n/use-localization-languages", () => ({
	useLocalizationLanguages: () => ["zh", "en"],
}));

vi.mock("@/features/application-shell/components/app-link", () => ({
	AppLink: ({ children, href }: { readonly children: ReactNode; readonly href: string }) => (
		<a href={href}>{children}</a>
	),
}));

vi.mock("@rezics/openapi-tanstack-query", () => ({
	useGetApiRealmsByRealmIdTaxonomyDraft: () => ({
		data: {
			structureId: "019fa3ab-72a9-7792-b2e3-43aa8a9c755d",
			latestRevisionId: "019fa3ab-72a9-7792-b2e3-43aa8a9c755e",
			items: [],
		},
		error: null,
		isError: false,
		isPending: false,
		refetch: vi.fn(),
	}),
	usePutApiRealmsByRealmIdUnitsByUnitIdPolicyTagsByTagId: () => ({
		error: null,
		isPending: false,
		mutateAsync: vi.fn(),
	}),
}));

vi.mock("@tanstack/react-query", () => ({
	useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@rezics/ui", async () => {
	const actual = await vi.importActual<typeof import("@rezics/ui")>("@rezics/ui");
	return {
		...actual,
		Dialog: ({ children, open }: { readonly children: ReactNode; readonly open: boolean }) =>
			open ? <section role="dialog">{children}</section> : null,
		DialogBody: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
		DialogContent: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
		DialogFooter: ({ children }: { readonly children: ReactNode }) => (
			<footer>{children}</footer>
		),
		DialogHeader: ({
			description,
			title,
		}: {
			readonly description: ReactNode;
			readonly title: ReactNode;
		}) => (
			<header>
				<h2>{title}</h2>
				<p>{description}</p>
			</header>
		),
	};
});

const translation = await create(resources).getTranslation(
	["actions", "betterAuthErrorCodes", "errorCodes", "errors", "realms", "state", "tags", "ui"],
	["zh-Hant"],
);

afterEach(cleanup);

describe("RealmPolicyTagDialog", () => {
	it("opens with an actionable empty state when the Realm has no policy Tags", () => {
		render(
			<TranslationProvider initial={translation.snapshot}>
				<RealmPolicyTagDialog
					onOpenChange={vi.fn()}
					open
					realmId="019fa3ab-72a9-7792-b2e3-43aa8a9c755d"
					unitId="019fa3ab-72a9-7792-b2e3-43aa8a9c755f"
				/>
			</TranslationProvider>,
		);

		expect(screen.getByRole("dialog")).toBeTruthy();
		expect(screen.getByText("此領域尚未設定可套用的政策標籤。")).toBeTruthy();
		expect(screen.getByRole("link", { name: "前往標籤設定" }).getAttribute("href")).toBe(
			"/realm/019fa3ab-72a9-7792-b2e3-43aa8a9c755d/settings/tags",
		);
	});
});
