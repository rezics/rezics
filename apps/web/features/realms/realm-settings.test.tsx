/** @vitest-environment jsdom */

import type { GetApiRealmsByRealmIdRulesAuthoringStatus200 } from "@rezics/openapi-tanstack-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	invalidateQueries: vi.fn(),
	save: vi.fn(),
}));

vi.mock("@rezics/openapi-tanstack-query", () => ({
	getApiRealmsByRealmIdRulesAuthoringQueryKey: (input: unknown) => [
		"realm-rules-authoring",
		input,
	],
	getApiRealmsByRealmIdRulesQueryKey: (input: unknown) => ["realm-rules", input],
	usePutApiRealmsByRealmIdRules: () => ({
		error: null,
		isPending: false,
		mutate: state.save,
	}),
}));

vi.mock("@tanstack/react-query", () => ({
	useQueryClient: () => ({ invalidateQueries: state.invalidateQueries }),
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
				addRuleTranslation: "新增翻譯",
				moveRuleDown: ({ position }: { position: number }) => `將第 ${position} 條規則下移`,
				moveRuleUp: ({ position }: { position: number }) => `將第 ${position} 條規則上移`,
				removeRuleTranslation: "移除翻譯",
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
				ruleMoved: ({ position, count }: { position: number; count: number }) =>
					`已移至 ${position}/${count}`,
				ruleNumber: ({ position }: { position: number }) => `第 ${position} 條規則`,
				ruleTitle: "規則標題",
				ruleTranslationCount: ({ count }: { count: number }) => `翻譯：${count}`,
				ruleTranslationMissing: ({ language }: { language: string }) =>
					`尚未新增${language}翻譯。`,
				ruleTranslationsIncomplete: "每個翻譯都必須填寫標題。",
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

	type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
		readonly isLoading?: boolean;
		readonly size?: string;
		readonly variant?: string;
	};
	return {
		Button: ({
			children,
			isLoading: _isLoading,
			size: _size,
			variant: _variant,
			...props
		}: ButtonProps) => React.createElement("button", props, children),
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
		Skeleton: passthrough,
		Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) =>
			React.createElement("textarea", props),
	};
});

vi.mock("@/features/editor/portable-text-editor", async () => {
	const React = await import("react");
	return {
		PortableTextEditor: ({ label }: { readonly label: string }) =>
			React.createElement("div", { "data-testid": "portable-text-editor" }, label),
	};
});

vi.mock("@/features/application-shell/hooks/use-application-router", () => ({
	useApplicationRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("@/features/content-languages/components/content-language-control", () => ({
	ContentLanguageControl: () => null,
}));
vi.mock("@/features/content-languages/components/localized-draft-gate", () => ({
	LocalizedDraftGate: ({ children }: { readonly children: ReactNode }) => children,
}));
vi.mock("@/features/content-languages/hooks/use-content-language-editor", async () => {
	const React = await import("react");
	return {
		useContentLanguageEditor: () => ({
			languagesChanged: vi.fn(),
			selectedLanguage: "zh",
			selectedLanguageIsPending: false,
		}),
		useLocalizedDraft: <Value extends object>({
			createInitialValue,
		}: {
			readonly createInitialValue: () => Value;
		}) => {
			const [value, setValueState] = React.useState(createInitialValue);
			const [dirty, setDirty] = React.useState(false);
			const setValue: Dispatch<SetStateAction<Value>> = (action) => {
				setValueState(action);
				setDirty(true);
			};
			return {
				value,
				setValue,
				dirty,
				hydrated: true,
				serverChanged: false,
				commit: () => setDirty(false),
				discard: vi.fn(),
			};
		},
	};
});
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
	readPortableText: (document: { readonly content: unknown[] }) => document.content,
	writePortableText: (content: unknown[]) => ({
		_key: "abcdef123456",
		_type: "portable-text",
		content,
	}),
}));
vi.mock("./query", () => ({ invalidateRealmDetails: vi.fn() }));

import { RealmRules } from "./realm-settings";

const emptyDocument = (key: string) => ({
	_key: key,
	_type: "portable-text" as const,
	content: [],
});

const rulesData = {
	acknowledgementMode: "explicit",
	items: [
		{
			id: "019f995d-7595-7c99-9183-250790bbfe2f",
			position: 0,
			localizations: [
				{
					content: emptyDocument("abcdef123456"),
					language: "en",
					title: "Be civil",
				},
				{
					content: emptyDocument("abcdef123457"),
					language: "ja",
					title: "礼儀を守る",
				},
			],
		},
		{
			id: "019f995d-7595-7c99-9183-250790bbfe30",
			position: 1,
			localizations: [
				{
					content: emptyDocument("abcdef123458"),
					language: "en",
					title: "Stay relevant",
				},
				{
					content: emptyDocument("abcdef123459"),
					language: "ja",
					title: "話題を守る",
				},
			],
		},
	],
	requireOnJoin: false,
	requireOnPost: false,
	revisionId: "019f995d-7595-7c99-9183-250790bbfe31",
	version: 1,
} satisfies GetApiRealmsByRealmIdRulesAuthoringStatus200;

beforeEach(() => {
	state.invalidateQueries.mockReset();
	state.save.mockReset();
});

afterEach(cleanup);

function renderRules() {
	return render(
		<RealmRules
			data={rulesData}
			embedded
			error={undefined}
			pending={false}
			realmId="019f995d-7595-7c99-9183-250790bbfe32"
		/>,
	);
}

describe("RealmRules", () => {
	it("does not publish a new revision when only the viewed language changes", () => {
		renderRules();
		const languageSelect = screen.getAllByRole("combobox")[1];
		const save = screen.getByRole("button", { name: "儲存" });
		if (!languageSelect) throw new Error("Expected the rule language selector");

		expect((save as HTMLButtonElement).disabled).toBe(true);
		fireEvent.change(languageSelect, { target: { value: "ja" } });
		expect((save as HTMLButtonElement).disabled).toBe(true);
		expect(state.save).not.toHaveBeenCalled();
	});

	it("keeps each language draft and submits every localization together", () => {
		renderRules();
		const languageSelect = screen.getAllByRole("combobox")[1];
		if (!languageSelect) throw new Error("Expected the rule language selector");

		fireEvent.change(screen.getByDisplayValue("Be civil"), {
			target: { value: "Be kind" },
		});
		fireEvent.change(languageSelect, { target: { value: "ja" } });
		fireEvent.change(screen.getByDisplayValue("礼儀を守る"), {
			target: { value: "親切にする" },
		});
		fireEvent.change(languageSelect, { target: { value: "en" } });
		expect(screen.getByDisplayValue("Be kind")).toBeTruthy();
		fireEvent.change(languageSelect, { target: { value: "ja" } });
		expect(screen.getByDisplayValue("親切にする")).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "儲存" }));

		expect(state.save).toHaveBeenCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({
					baseRevisionId: rulesData.revisionId,
					rules: [
						expect.objectContaining({
							localizations: [
								expect.objectContaining({ language: "en", title: "Be kind" }),
								expect.objectContaining({ language: "ja", title: "親切にする" }),
							],
						}),
						expect.any(Object),
					],
				}),
				path: { realmId: "019f995d-7595-7c99-9183-250790bbfe32" },
			}),
			expect.any(Object),
		);
	});

	it("moves rules with the arrow controls and submits the new order", () => {
		renderRules();
		fireEvent.click(screen.getByRole("button", { name: "將第 2 條規則上移" }));
		fireEvent.click(screen.getByRole("button", { name: "儲存" }));

		const request = state.save.mock.calls[0]?.[0];
		expect(request?.body.rules[0].localizations[0].title).toBe("Stay relevant");
		expect(request?.body.rules[1].localizations[0].title).toBe("Be civil");
	});

	it("reloads the latest authoring revision after a save conflict", async () => {
		renderRules();
		fireEvent.change(screen.getByDisplayValue("Be civil"), {
			target: { value: "Be kind" },
		});
		fireEvent.click(screen.getByRole("button", { name: "儲存" }));

		const callbacks = state.save.mock.calls[0]?.[1] as
			| { readonly onError?: (error: unknown) => Promise<void> }
			| undefined;
		await callbacks?.onError?.({
			data: { error: { code: "RealmRuleRevisionChanged" } },
		});

		expect(state.invalidateQueries).toHaveBeenCalledOnce();
		expect(state.invalidateQueries).toHaveBeenCalledWith({
			queryKey: [
				"realm-rules-authoring",
				{ path: { realmId: "019f995d-7595-7c99-9183-250790bbfe32" } },
			],
		});
	});
});
