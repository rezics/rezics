import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrowserMarkdownStorage } from "./browser-storage";

function installOpenPicker(file: File, createWritable = vi.fn()) {
	const handle = {
		name: file.name,
		getFile: vi.fn(async () => file),
		createWritable,
	};
	Reflect.set(
		globalThis,
		"showOpenFilePicker",
		vi.fn(async () => [handle]),
	);
	return handle;
}

afterEach(() => {
	Reflect.deleteProperty(globalThis, "showOpenFilePicker");
});

describe("browser Markdown storage", () => {
	it("preserves a UTF-8 byte-order mark in the source value", async () => {
		installOpenPicker(new File([new Uint8Array([0xef, 0xbb, 0xbf]), "# Document"], "document.md"));

		const result = await createBrowserMarkdownStorage().openDocument();
		expect(result.ok).toBe(true);
		if (!result.ok || !result.value) return;
		expect(result.value.source).toBe("\uFEFF# Document");
	});

	it("detects an external file change before creating a writer", async () => {
		let currentFile = new File(["before"], "document.md");
		const createWritable = vi.fn();
		const handle = installOpenPicker(currentFile, createWritable);
		handle.getFile.mockImplementation(async () => currentFile);
		const storage = createBrowserMarkdownStorage();
		const opened = await storage.openDocument();
		expect(opened.ok).toBe(true);
		if (!opened.ok || !opened.value) return;

		currentFile = new File(["external"], "document.md");
		await expect(
			storage.saveDocument({
				storageId: opened.value.storageId,
				expectedFingerprint: opened.value.fingerprint,
				source: "editor",
			}),
		).resolves.toEqual({ ok: false, error: { code: "conflict" } });
		expect(createWritable).not.toHaveBeenCalled();
	});
});
