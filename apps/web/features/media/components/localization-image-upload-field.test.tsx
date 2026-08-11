/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { create } from "native-i18n";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { LocalizationImageUploadField } from "./localization-image-upload-field";

const state = vi.hoisted(() => ({
	completeUpload: vi.fn(),
	deleteUpload: vi.fn(() => Promise.resolve()),
	requestUpload: vi.fn(),
	testFile: undefined as File | undefined,
}));

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

vi.mock("@rezics/openapi-tanstack-query", () => ({
	useDeleteApiImageAssetsById: () => ({ mutateAsync: state.deleteUpload }),
	usePostApiImageAssets: () => ({ mutateAsync: state.requestUpload }),
	usePostApiImageAssetsByIdComplete: () => ({ mutateAsync: state.completeUpload }),
}));

vi.mock("@rezics/ui", () => ({
	Banner: (props: ComponentProps<"img">) => <img {...props} />,
	Button: ({
		isLoading: _isLoading,
		...props
	}: ComponentProps<"button"> & { isLoading?: boolean }) => <button {...props} />,
	Cover: (props: ComponentProps<"img">) => <img {...props} />,
	FileUpload: ({
		"aria-busy": ariaBusy,
		children,
		onFileAccept,
	}: {
		readonly "aria-busy"?: boolean;
		readonly children: ReactNode;
		readonly onFileAccept?: (details: { readonly files: readonly File[] }) => void;
	}) => (
		<div aria-busy={ariaBusy}>
			<button
				aria-label="Accept test file"
				onClick={() => onFileAccept?.({ files: state.testFile ? [state.testFile] : [] })}
				type="button"
			/>
			{children}
		</div>
	),
	FileUploadDropzone: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
	FileUploadDropzoneIcon: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
	FileUploadHelper: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
	FileUploadTitle: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
	FileUploadTrigger: ({ children }: { readonly children: ReactNode }) => children,
	NativeSelect: (props: ComponentProps<"select">) => <select {...props} />,
	NativeSelectOption: (props: ComponentProps<"option">) => <option {...props} />,
	Progress: ({
		indeterminate,
		value,
		...props
	}: ComponentProps<"div"> & { readonly indeterminate?: boolean; readonly value?: number }) => (
		<div
			{...props}
			aria-valuenow={indeterminate ? undefined : value}
			data-indeterminate={indeterminate ? "true" : "false"}
			role="progressbar"
		/>
	),
	cn: (...values: readonly unknown[]) => values.filter(Boolean).join(" "),
}));

vi.mock("./image-asset-presentation-editor", () => ({
	ImageAssetPresentationEditor: () => null,
}));

type Deferred<T> = {
	readonly promise: Promise<T>;
	resolve(value: T): void;
};

function deferred<T>(): Deferred<T> {
	let resolvePromise: ((value: T) => void) | undefined;
	const promise = new Promise<T>((resolve) => {
		resolvePromise = resolve;
	});
	return {
		promise,
		resolve(value) {
			if (!resolvePromise) throw new Error("Deferred promise has no resolver");
			resolvePromise(value);
		},
	};
}

class XMLHttpRequestMock {
	static latest: XMLHttpRequestMock | undefined;

	readonly upload: { onprogress: ((event: ProgressEvent) => void) | null } = {
		onprogress: null,
	};
	onabort: ((event: ProgressEvent) => void) | null = null;
	onerror: ((event: ProgressEvent) => void) | null = null;
	onload: (() => void) | null = null;
	status = 200;

	constructor() {
		XMLHttpRequestMock.latest = this;
	}

	abort(): void {
		this.onabort?.(new ProgressEvent("abort"));
	}

	open(): void {}
	send(): void {}
	setRequestHeader(): void {}
}

const translation = await create(resources).getTranslation(["media"], ["zh-Hant"]);

beforeEach(() => {
	state.completeUpload.mockReset();
	state.deleteUpload.mockClear();
	state.requestUpload.mockReset();
	state.testFile = new File(["image"], "avatar.png", { type: "image/png" });
	XMLHttpRequestMock.latest = undefined;
	vi.stubGlobal("XMLHttpRequest", XMLHttpRequestMock);
	vi.stubGlobal("URL", {
		createObjectURL: vi.fn(() => "blob:test-preview"),
		revokeObjectURL: vi.fn(),
	});
});

afterEach(cleanup);

describe("LocalizationImageUploadField", () => {
	it("keeps upload progress visible through preparation, transfer, and server processing", async () => {
		const uploadRequest = deferred<{
			readonly id: string;
			readonly upload: { readonly headers: Record<string, string>; readonly url: string };
		}>();
		const completionRequest = deferred<{
			readonly id: string;
			readonly presentations: readonly {
				readonly contentUrl: string;
				readonly role: string;
			}[];
		}>();
		state.requestUpload.mockReturnValue(uploadRequest.promise);
		state.completeUpload.mockReturnValue(completionRequest.promise);
		const onChange = vi.fn();

		render(
			<TranslationProvider initial={translation.snapshot}>
				<LocalizationImageUploadField onChange={onChange} role="avatar" value={null} />
			</TranslationProvider>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Accept test file" }));
		const preparingStatus = await screen.findByRole("status");
		expect(preparingStatus.textContent).toContain("正在準備上傳圖片……");
		expect(preparingStatus.className.split(" ")).toContain("z-20");
		expect(screen.getByRole("progressbar").getAttribute("data-indeterminate")).toBe("true");

		act(() => {
			uploadRequest.resolve({ id: "asset-1", upload: { headers: {}, url: "/upload" } });
		});
		await waitFor(() => expect(XMLHttpRequestMock.latest).toBeDefined());
		expect(screen.getByRole("status").textContent).toContain("正在上傳圖片……");

		act(() => {
			XMLHttpRequestMock.latest?.upload.onprogress?.(
				new ProgressEvent("progress", { lengthComputable: true, loaded: 4, total: 10 }),
			);
		});
		expect(screen.getByRole("status").textContent).toContain("正在上傳圖片……40%");
		expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("40");

		act(() => {
			XMLHttpRequestMock.latest?.onload?.();
		});
		expect((await screen.findByRole("status")).textContent).toContain("上傳完成，正在處理圖片……");
		expect(screen.getByRole("progressbar").getAttribute("data-indeterminate")).toBe("true");

		act(() => {
			completionRequest.resolve({
				id: "asset-1",
				presentations: [{ contentUrl: "/image/avatar", role: "avatar" }],
			});
		});
		await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
		expect(onChange).toHaveBeenCalledWith({ id: "asset-1", url: "/image/avatar" });
	});
});
