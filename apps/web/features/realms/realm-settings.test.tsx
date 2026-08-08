/** @vitest-environment jsdom */

import type { GetApiRealmsByRealmIdRulesStatus200 } from "@rezics/openapi-tanstack-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	editorMounts: 0,
	fetchQuery: vi.fn(),
	invalidateQueries: vi.fn(),
	save: vi.fn(),
}));

vi.mock("@rezics/openapi-tanstack-query", () => ({
	getApiRealmsByRealmIdRulesQueryKey: (input: unknown) => ["realm-rules", input],
	getApiRealmsByRealmIdRulesQueryOptions: (input: unknown) => ({
		queryKey: ["realm-rule-localization", input],
	}),
	useGetApiUnitsByIdByUnitIdLocalizationOrder: () => ({
		data: { languages: ["en", "ja"] },
		error: null,
		isError: false,
		isPending: false,
	}),
	usePutApiRealmsByRealmIdRules: () => ({
		error: null,
		isPending: false,
		mutate: state.save,
	}),
}));

vi.mock("@tanstack/react-query", () => ({
	useQueryClient: () => ({
		fetchQuery: state.fetchQuery,
		invalidateQueries: state.invalidateQueries,
	}),
}));

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		locale: { target: "zh-Hant" },
		t: {
			errors: { unknown: "未知錯誤" },
			locale: {
				contentLanguages: {
					de: "德文",
					en: "英文",
					es: "西班牙文",
					fr: "法文",
					ja: "日文",
					ko: "韓文",
					zh: "中文",
				},
			},
			realms: {
				addRule: "新增規則",
				requireOnJoin: "加入前須同意",
				requireOnPost: "發布前須同意",
				ruleAcknowledgementHint: "規則提示",
				ruleAcknowledgementMode: "確認模式",
				ruleAcknowledgementModes: {
					explicit: "明確確認",
					implicitOnFollow: "追蹤時確認",
				},
				ruleContent: "規則內容",
				ruleLanguage: "規則語言",
				ruleTitle: "規則標題",
				removeRule: "移除規則",
				rules: "規則",
			},
			state: { loading: "正在載入…" },
			ui: { save: "儲存" },
		},
	}),
}));

vi.mock("@rezics/ui", async () => {
	const React = await import("react");
	const actual = await vi.importActual<typeof import("@rezics/ui")>("@rezics/ui");
	const passthrough = ({ children }: { children?: ReactNode }) =>
		React.createElement("div", null, children);

	return {
		Button: ({
			children,
			disabled,
			onClick,
			type = "button",
		}: {
			children?: ReactNode;
			disabled?: boolean;
			onClick?: () => void;
			type?: "button" | "submit";
		}) => React.createElement("button", { disabled, onClick, type }, children),
		Card: passthrough,
		CardContent: passthrough,
		Checkbox: ({ checked }: { checked: boolean }) =>
			React.createElement("input", { checked, readOnly: true, type: "checkbox" }),
		Field: passthrough,
		FieldGroup: passthrough,
		FieldLabel: ({ children }: { children?: ReactNode }) =>
			React.createElement("label", null, children),
		Input: (props: React.InputHTMLAttributes<HTMLInputElement>) =>
			React.createElement("input", props),
		NativeSelect: actual.NativeSelect,
		NativeSelectOption: actual.NativeSelectOption,
		RequestFailure: () => null,
		Skeleton: passthrough,
		Spinner: passthrough,
		Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) =>
			React.createElement("textarea", props),
	};
});

vi.mock("@/features/editor/portable-text-editor", async () => {
	const React = await import("react");
	return {
		PortableTextEditor: () => {
			const [mountId] = React.useState(() => {
				state.editorMounts += 1;
				return state.editorMounts;
			});
			return React.createElement("output", { "data-testid": "editor-mount" }, mountId);
		},
	};
});

vi.mock("@/features/application-shell/hooks/use-application-router", () => ({
	useApplicationRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("@/features/content-languages/components/content-language-control", () => ({
	ContentLanguageControl: () => null,
}));
vi.mock("@/features/content-languages/hooks/use-content-language-editor", () => ({
	useContentLanguageEditor: () => ({
		languagesChanged: vi.fn(),
		selectedLanguage: "zh",
		selectedLanguageIsPending: false,
		setDirty: vi.fn(),
	}),
}));
vi.mock("@/features/media/components/avatar-field", () => ({
	AvatarField: () => null,
	avatarPresentationToInput: () => null,
}));
vi.mock("@/features/media/components/localization-image-upload-field", () => ({
	LocalizationImageUploadField: () => null,
}));
vi.mock("@/features/media/components/localization-media-fallback-notice", () => ({
	LocalizationMediaFallbackNotice: () => null,
}));
vi.mock("@/features/preview-access/components/development-preview-boundary", () => ({
	DevelopmentPreviewBoundary: ({ children }: { children?: ReactNode }) => children,
}));
vi.mock("@/features/slugs/slug-address-form", () => ({ SlugAddressForm: () => null }));
vi.mock("@/i18n/request-failure", () => ({ RequestFailure: () => null }));
vi.mock("@/lib/block", () => ({
	readPortableText: (document: { content: unknown[] }) => document.content,
	writePortableText: (_content: unknown, document: unknown) => document,
}));
vi.mock("./query", () => ({ invalidateRealmDetails: vi.fn() }));

import { RealmRules } from "./realm-settings";

const rulesData = {
	acknowledgementMode: "explicit",
	items: [
		{
			content: {
				_key: "abcdef123456",
				_type: "portable-text",
				content: [],
			},
			id: "rule-id",
			language: "en",
			position: 0,
			title: "Be civil",
		},
	],
	requireOnJoin: false,
	requireOnPost: false,
	revisionId: "revision-id",
	version: 1,
} satisfies GetApiRealmsByRealmIdRulesStatus200;

const japaneseRulesData = {
	...rulesData,
	items: rulesData.items.map((rule) => ({
		...rule,
		language: "ja" as const,
		title: "礼儀を守る",
	})),
} satisfies GetApiRealmsByRealmIdRulesStatus200;

beforeEach(() => {
	state.editorMounts = 0;
	state.fetchQuery.mockReset();
	state.fetchQuery.mockResolvedValue(japaneseRulesData);
	state.invalidateQueries.mockReset();
	state.save.mockReset();
});

afterEach(cleanup);

describe("RealmRules", () => {
	it("loads and saves a persisted rule in its independently selected language", async () => {
		const { rerender } = render(
			<RealmRules
				data={rulesData}
				embedded
				error={undefined}
				pending={false}
				realmId="realm-id"
			/>,
		);

		await waitFor(() => expect(screen.getByDisplayValue("Be civil")).toBeTruthy());
		const selects = screen.getAllByRole("combobox");
		expect(selects).toHaveLength(2);
		const languageSelect = selects[1];
		if (!languageSelect) throw new Error("Expected the rule language selector");
		expect(screen.getByTestId("editor-mount").textContent).toBe("1");

		fireEvent.change(languageSelect, { target: { value: "ja" } });

		await waitFor(() => expect(screen.getByDisplayValue("礼儀を守る")).toBeTruthy());
		expect(state.fetchQuery).toHaveBeenCalledWith({
			queryKey: [
				"realm-rule-localization",
				{
					path: { realmId: "realm-id" },
					query: { localizationLanguages: ["ja"] },
				},
			],
		});

		rerender(
			<RealmRules
				data={{ ...rulesData, items: rulesData.items.map((item) => ({ ...item })) }}
				embedded
				error={undefined}
				pending={false}
				realmId="realm-id"
			/>,
		);

		await waitFor(() => {
			const languageSelects = screen.getAllByRole("combobox");
			expect((languageSelects[1] as HTMLSelectElement).value).toBe("ja");
		});
		expect(screen.getByDisplayValue("礼儀を守る")).toBeTruthy();
		expect(screen.getByTestId("editor-mount").textContent).toBe("2");

		fireEvent.click(screen.getByRole("button", { name: "儲存" }));

		expect(state.save).toHaveBeenCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({
					rules: [expect.objectContaining({ language: "ja", title: "礼儀を守る" })],
				}),
				path: { realmId: "realm-id" },
			}),
			expect.any(Object),
		);
	});
});
