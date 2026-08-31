/** @vitest-environment jsdom */

import type { ReactNode } from "react";
import { resources } from "@rezics/i18n/resources";
import type { DehydratedState } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

type ProviderProps = { readonly children: ReactNode };

vi.mock("@rezics/ui", () => ({
	Toaster: () => <div data-testid="toaster" />,
}));

vi.mock("nuqs/adapters/next/app", () => ({
	NuqsAdapter: ({ children }: ProviderProps) => <div data-testid="nuqs">{children}</div>,
}));

vi.mock("@/features/application-shell/components/ui-provider", () => ({
	ApplicationUiProvider: ({ children }: ProviderProps) => (
		<div data-testid="application-ui">{children}</div>
	),
}));

vi.mock("@/features/application-shell/navigation-progress", () => ({
	NavigationProgressProvider: ({ children }: ProviderProps) => (
		<div data-testid="navigation">{children}</div>
	),
}));

vi.mock("@/features/auth/auth-portal", () => ({
	AuthPortalProvider: ({ children }: ProviderProps) => (
		<div data-testid="auth-portal">{children}</div>
	),
}));

vi.mock("@/features/auth/session-provider", () => ({
	AuthSessionProvider: ({ children }: ProviderProps) => (
		<div data-testid="auth-session">{children}</div>
	),
}));

vi.mock("@/features/auth/session-query-client-boundary", () => ({
	SessionQueryClientBoundary: ({ children }: ProviderProps) => (
		<div data-testid="query-client">{children}</div>
	),
}));

vi.mock("@/features/pwa/pwa-lifecycle", () => ({
	PwaLifecycle: () => <div data-testid="pwa" />,
}));

vi.mock("@/i18n/client", () => ({
	TranslationProvider: ({ children }: ProviderProps) => (
		<div data-testid="translation">{children}</div>
	),
}));

import { RootTranslationNamespaces } from "@/i18n/namespaces";
import { AppProviders } from "./app-providers";

const translation = await create(resources).getTranslation(RootTranslationNamespaces, ["en"]);
const dehydratedState: DehydratedState = { mutations: [], queries: [] };

afterEach(cleanup);

describe("AppProviders", () => {
	it("places session-aware UI below both session and query providers", () => {
		render(
			<AppProviders
				browserContentLanguages={["en"]}
				dehydratedState={dehydratedState}
				initialSession={{ status: "resolved", data: null }}
				initialTranslation={translation.snapshot}
				turnstileSiteKey="test-site-key"
			>
				<span>content</span>
			</AppProviders>,
		);

		const navigation = screen.getByTestId("navigation");
		const authSession = screen.getByTestId("auth-session");
		const queryClient = screen.getByTestId("query-client");
		const applicationUi = screen.getByTestId("application-ui");
		const authPortal = screen.getByTestId("auth-portal");
		const pwa = screen.getByTestId("pwa");

		expect(authSession.parentElement).toBe(navigation);
		expect(queryClient.parentElement).toBe(authSession);
		expect(applicationUi.parentElement).toBe(queryClient);
		expect(authPortal.parentElement).toBe(applicationUi);
		expect(pwa.parentElement).toBe(authSession);
		expect(screen.getByText("content")).toBeTruthy();
	});
});
