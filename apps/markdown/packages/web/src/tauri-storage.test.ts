import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTauriMarkdownStorage, decodeTauriStorageError } from "./tauri-storage";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const validOpenedDocument = {
	storageId: "45c56868-bd3e-4f63-b5e0-48af340532cc",
	name: "document.md",
	source: "# Document",
	fingerprint: "a".repeat(64),
	canOverwrite: true,
};

describe("Tauri Markdown storage decoder", () => {
	beforeEach(() => invokeMock.mockReset());

	it("accepts the exact native open-document contract", async () => {
		invokeMock.mockResolvedValue(validOpenedDocument);

		await expect(createTauriMarkdownStorage().openDocument()).resolves.toEqual({
			ok: true,
			value: validOpenedDocument,
		});
	});

	it("rejects unexpected fields and path-shaped document names", async () => {
		invokeMock.mockResolvedValue({
			...validOpenedDocument,
			nativePath: "/private/document.md",
		});
		await expect(createTauriMarkdownStorage().openDocument()).resolves.toEqual({
			ok: false,
			error: { code: "invalid-response" },
		});

		invokeMock.mockResolvedValue({ ...validOpenedDocument, name: "../document.md" });
		await expect(createTauriMarkdownStorage().openDocument()).resolves.toEqual({
			ok: false,
			error: { code: "invalid-response" },
		});
	});

	it("maps only known native error tags into the application contract", () => {
		expect(decodeTauriStorageError({ code: "conflict" })).toBe("conflict");
		expect(decodeTauriStorageError({ code: "future-native-error" })).toBe("io");
	});
});
