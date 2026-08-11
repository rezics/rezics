/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { AvatarField } from "./avatar-field";

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

vi.mock("./localization-image-upload-field", async () => {
	const { Button } = await import("@rezics/ui");
	return {
		LocalizationImageUploadField: ({
			onChange,
			onPresentationSaved,
		}: {
			readonly onChange: (value: { readonly id: string; readonly url: string }) => void;
			readonly onPresentationSaved?: () => void;
		}) => (
			<Button
				onClick={() => {
					onChange({ id: "asset-1", url: "https://example.com/avatar.jpg" });
					onPresentationSaved?.();
				}}
				type="button"
			>
				Upload test image
			</Button>
		),
	};
});

vi.mock("./font-awesome-icon-picker", () => ({
	FontAwesomeIconPicker: () => null,
}));

vi.mock("./avatar-emoji-picker", () => ({
	AvatarEmojiPicker: () => null,
}));

vi.stubGlobal(
	"ResizeObserver",
	class ResizeObserverMock {
		observe() {}
		unobserve() {}
		disconnect() {}
	},
);
vi.stubGlobal(
	"IntersectionObserver",
	class IntersectionObserverMock {
		observe() {}
		unobserve() {}
		disconnect() {}
	},
);
vi.stubGlobal("CSS", { escape: (value: string) => value });

afterEach(cleanup);

const translation = await create(resources).getTranslation(["media"], ["zh-Hant"]);

function renderField(element: React.ReactNode) {
	return render(
		<TranslationProvider initial={translation.snapshot}>{element}</TranslationProvider>,
	);
}

describe("AvatarField", () => {
	it("opens a modal with image first when no avatar is set", async () => {
		const onChange = vi.fn();
		renderField(<AvatarField onChange={onChange} value={null} />);

		fireEvent.click(screen.getByRole("button", { name: "設定頭像" }));

		expect(await screen.findByRole("dialog")).toBeTruthy();
		const tabs = screen.getAllByRole("tab");
		expect(tabs.map((tab) => tab.textContent)).toEqual(["圖片", "圖示", "表情符號"]);
		expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
	});

	it("shows the fallback preview without per-field policy copy or a remove action", async () => {
		const onChange = vi.fn();
		renderField(
			<AvatarField fallback={{ type: "emoji", emoji: "🦈" }} onChange={onChange} value={null} />,
		);

		expect(screen.queryByText("繼承的頭像")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "編輯頭像" }));
		expect(await screen.findByRole("dialog")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "使用繼承頭像" })).toBeNull();
	});

	it("removes an override and closes the modal", async () => {
		const onChange = vi.fn();
		renderField(
			<AvatarField
				fallback={{ type: "emoji", emoji: "🌊" }}
				onChange={onChange}
				value={{ type: "emoji", emoji: "🦈" }}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "編輯頭像" }));
		fireEvent.click(await screen.findByRole("button", { name: "使用繼承頭像" }));

		expect(onChange).toHaveBeenCalledWith(null);
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	});

	it("selects an uploaded image and closes the modal", async () => {
		const onChange = vi.fn();
		renderField(<AvatarField onChange={onChange} value={null} />);

		fireEvent.click(screen.getByRole("button", { name: "設定頭像" }));
		fireEvent.click(await screen.findByRole("button", { name: "Upload test image" }));

		expect(onChange).toHaveBeenCalledWith({
			type: "image",
			image: { id: "asset-1", url: "https://example.com/avatar.jpg" },
		});
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	});
});
