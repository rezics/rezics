/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { create } from "native-i18n";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { UnitMetadataEditor, type EditableUnit } from "./unit-edit";

const api = vi.hoisted(() => ({ mutateAsync: vi.fn() }));
const AudioUnitId = "00000000-0000-4000-8000-000000000010";
const ParentUnitId = "00000000-0000-4000-8000-000000000020";

vi.mock("@rezics/openapi-tanstack-query", async (importOriginal) => {
	const original = await importOriginal<typeof import("@rezics/openapi-tanstack-query")>();
	return {
		...original,
		usePatchApiUnitsByTypeByUnitId: () => ({
			error: null,
			isPending: false,
			mutateAsync: api.mutateAsync,
		}),
	};
});

vi.mock("@rezics/ui", () => {
	const Block = ({ children }: { readonly children?: ReactNode }) => <div>{children}</div>;
	return {
		Badge: Block,
		Button: ({
			isLoading: _isLoading,
			variant: _variant,
			...props
		}: ComponentProps<"button"> & {
			readonly isLoading?: boolean;
			readonly variant?: string;
		}) => <button {...props} />,
		Card: Block,
		CardContent: Block,
		Field: Block,
		FieldGroup: Block,
		FieldLabel: ({ children, ...props }: ComponentProps<"label">) => (
			<label {...props}>{children}</label>
		),
		Input: (props: ComponentProps<"input">) => <input {...props} />,
		NativeSelect: (props: ComponentProps<"select">) => <select {...props} />,
		NativeSelectOption: (props: ComponentProps<"option">) => <option {...props} />,
		Textarea: (props: ComponentProps<"textarea">) => <textarea {...props} />,
	};
});

vi.mock("@/features/content-language-support/components/content-language-support-field", () => ({
	ContentLanguageSupportField: ({
		onChange,
	}: {
		readonly onChange: (
			value: readonly {
				readonly languageTag: string;
				readonly channels?: readonly ("text" | "audio" | "subtitle" | "interface")[];
			}[],
		) => void;
	}) => (
		<>
			<button onClick={() => onChange([{ languageTag: "en", channels: ["audio"] }])} type="button">
				Set content language
			</button>
			<button onClick={() => onChange([])} type="button">
				Clear content languages
			</button>
		</>
	),
}));

vi.mock("@/features/content-language-support/components/content-language-support-evidence", () => ({
	ContentLanguageSupportEvidence: () => null,
}));

vi.mock("./components/unit-licenses-field", () => ({ UnitLicensesField: () => null }));
vi.mock("./components/metadata-only-field", () => ({ MetadataOnlyField: () => null }));
vi.mock("./components/adapted-audio-field", () => ({
	AdaptedAudioField: ({ onChange }: { readonly onChange: (value: readonly string[]) => void }) => (
		<>
			<button onClick={() => onChange([AudioUnitId])} type="button">
				Select adapted audio
			</button>
			<button onClick={() => onChange([])} type="button">
				Clear adapted audio
			</button>
		</>
	),
}));

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

const translation = await create(resources).getTranslation(
	["cover", "errors", "licenses", "ui", "units"],
	["en"],
);

const commonUnit = {
	id: "00000000-0000-4000-8000-000000000001",
	status: "published",
	visibility: "public",
	language: "en",
	contentRating: "general",
	aiDisclosure: "none",
	licenses: [],
	licenseOfferings: [],
	postTargetingLocked: false,
	publishedAt: "2026-08-20T00:00:00.000Z",
	attributions: [],
	createdAt: "2026-08-20T00:00:00.000Z",
	updatedAt: "2026-08-20T00:00:00.000Z",
	releasedOn: null,
	avatar: null,
	banner: null,
	cover: null,
	localizations: [],
	subjectAssociations: [],
	externalLinks: [],
	tags: [],
	progressStatistics: null,
	versions: [],
	variantContext: { role: "standalone" },
	ownershipMode: "community_owned",
	ownershipClaim: null,
	capabilities: {
		canEdit: true,
		canUpdateMetadataOnly: true,
		canManageAccess: false,
		canManageAssociations: false,
		canCurateTags: false,
		canCurateReferences: { aliases: false, externalLinks: false },
		canManageRealmPublications: false,
		hasDevelopmentPreviewAccess: false,
	},
} satisfies Omit<EditableUnit, "contentLanguageSupport" | "details" | "type">;

afterEach(() => {
	cleanup();
	api.mutateAsync.mockReset().mockResolvedValue(undefined);
});

async function renderEditor(type: "video" | "release", unit: EditableUnit) {
	const queryClient = new QueryClient();
	await act(async () => {
		render(
			<QueryClientProvider client={queryClient}>
				<TranslationProvider initial={translation.snapshot}>
					<UnitMetadataEditor type={type} unit={unit} />
				</TranslationProvider>
			</QueryClientProvider>,
		);
	});
}

describe("UnitMetadataEditor content language integration", () => {
	it("submits Video language support and adapted Audio in the same PATCH", async () => {
		const unit = {
			...commonUnit,
			type: "video",
			contentLanguageSupport: [],
			details: { type: "video", durationSeconds: 90, adaptedAudioUnitIds: null },
		} satisfies EditableUnit;
		await renderEditor("video", unit);

		fireEvent.click(await screen.findByRole("button", { name: "Set content language" }));
		fireEvent.click(screen.getByRole("button", { name: "Select adapted audio" }));
		fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

		await waitFor(() => expect(api.mutateAsync).toHaveBeenCalledTimes(1));
		const request = api.mutateAsync.mock.calls[0]?.[0];
		expect(request).toMatchObject({
			path: { type: "video", unitId: unit.id },
			body: {
				contentLanguageSupport: [{ languageTag: "en", channels: ["audio"] }],
				details: { durationSeconds: 90, adaptedAudioUnitIds: [AudioUnitId] },
			},
		});
		expect(request.body).not.toHaveProperty("localizations");
	});

	it("omits unchanged language support and adapted Audio from a Video PATCH", async () => {
		const unit = {
			...commonUnit,
			type: "video",
			contentLanguageSupport: [],
			details: { type: "video", durationSeconds: 90, adaptedAudioUnitIds: null },
		} satisfies EditableUnit;
		await renderEditor("video", unit);

		fireEvent.click(await screen.findByRole("button", { name: "Save settings" }));

		await waitFor(() => expect(api.mutateAsync).toHaveBeenCalledTimes(1));
		const body = api.mutateAsync.mock.calls[0]?.[0].body;
		expect(body).not.toHaveProperty("contentLanguageSupport");
		expect(body.details).not.toHaveProperty("adaptedAudioUnitIds");
	});

	it("serializes clearing an existing Video adapted-Audio set as null", async () => {
		const unit = {
			...commonUnit,
			type: "video",
			contentLanguageSupport: [],
			details: { type: "video", durationSeconds: 90, adaptedAudioUnitIds: [AudioUnitId] },
		} satisfies EditableUnit;
		await renderEditor("video", unit);

		fireEvent.click(await screen.findByRole("button", { name: "Clear adapted audio" }));
		fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

		await waitFor(() => expect(api.mutateAsync).toHaveBeenCalledTimes(1));
		expect(api.mutateAsync.mock.calls[0]?.[0]).toMatchObject({
			body: { details: { adaptedAudioUnitIds: null } },
		});
	});

	it("edits Release metadata and its single language field through the generic PATCH", async () => {
		const unit = {
			...commonUnit,
			type: "release",
			releasedOn: "2026-08-01",
			contentLanguageSupport: [{ languageTag: "ja" }],
			details: {
				type: "release",
				parentUnitId: ParentUnitId,
				versionLabel: "1.0",
				releasedOn: "2026-08-01",
			},
		} satisfies EditableUnit;
		await renderEditor("release", unit);

		expect(screen.getByDisplayValue(ParentUnitId).hasAttribute("readonly")).toBe(true);
		fireEvent.change(screen.getByDisplayValue("1.0"), { target: { value: "1.1" } });
		fireEvent.click(screen.getByRole("button", { name: "Set content language" }));
		fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

		await waitFor(() => expect(api.mutateAsync).toHaveBeenCalledTimes(1));
		expect(api.mutateAsync.mock.calls[0]?.[0]).toMatchObject({
			path: { type: "release", unitId: unit.id },
			body: {
				contentLanguageSupport: [{ languageTag: "en", channels: ["audio"] }],
				unit: { releasedOn: "2026-08-01" },
				details: { versionLabel: "1.1" },
			},
		});
	});

	it("serializes clearing Release language support as the authoritative empty field", async () => {
		const unit = {
			...commonUnit,
			type: "release",
			contentLanguageSupport: [{ languageTag: "ja" }],
			details: {
				type: "release",
				parentUnitId: ParentUnitId,
				versionLabel: "1.0",
				releasedOn: null,
			},
		} satisfies EditableUnit;
		await renderEditor("release", unit);

		fireEvent.click(screen.getByRole("button", { name: "Clear content languages" }));
		fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

		await waitFor(() => expect(api.mutateAsync).toHaveBeenCalledTimes(1));
		expect(api.mutateAsync.mock.calls[0]?.[0]).toMatchObject({
			body: { contentLanguageSupport: [] },
		});
	});
});
