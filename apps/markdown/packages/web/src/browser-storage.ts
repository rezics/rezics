import {
	isMarkdownFileName,
	markdownStorageFailure,
	markdownStorageSuccess,
	maximumMarkdownDocumentBytes,
	normalizeMarkdownFileName,
	type MarkdownDocumentStorage,
	type MarkdownStorageResult,
	type OpenedMarkdownDocument,
	type SavedMarkdownDocument,
	type SaveMarkdownDocumentAsRequest,
	type SaveMarkdownDocumentRequest,
} from "@rezics/markdown-editor-app";

interface BrowserWritableFile {
	readonly write: (data: string) => Promise<void>;
	readonly close: () => Promise<void>;
}

interface BrowserFileHandle {
	readonly name: string;
	readonly getFile: () => Promise<File>;
	readonly createWritable: () => Promise<BrowserWritableFile>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBrowserFileHandle(value: unknown): value is BrowserFileHandle {
	return (
		isRecord(value) &&
		typeof value.name === "string" &&
		typeof value.getFile === "function" &&
		typeof value.createWritable === "function"
	);
}

function isPickerCancellation(error: unknown): boolean {
	return error instanceof DOMException && error.name === "AbortError";
}

function getGlobalFunction(name: string): ((...input: unknown[]) => unknown) | undefined {
	const candidate = Reflect.get(globalThis, name);
	if (typeof candidate !== "function") return undefined;
	return (...input) => Reflect.apply(candidate, globalThis, input);
}

async function fingerprint(bytes: ArrayBuffer): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readFile(
	file: File,
): Promise<MarkdownStorageResult<{ source: string; fingerprint: string }>> {
	if (!isMarkdownFileName(file.name)) return markdownStorageFailure("unsupported-extension");
	if (file.size > maximumMarkdownDocumentBytes) return markdownStorageFailure("too-large");
	const bytes = await file.arrayBuffer();
	try {
		const source = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
		return markdownStorageSuccess({ source, fingerprint: await fingerprint(bytes) });
	} catch {
		return markdownStorageFailure("invalid-encoding");
	}
}

function selectFallbackFile(): Promise<File | null> {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".md,.markdown,text/markdown";
		input.hidden = true;
		let settled = false;
		const finish = (file: File | null) => {
			if (settled) return;
			settled = true;
			window.removeEventListener("focus", onWindowFocus);
			input.remove();
			resolve(file);
		};
		const onWindowFocus = () => {
			window.setTimeout(() => finish(input.files?.item(0) ?? null), 0);
		};
		input.addEventListener("change", () => finish(input.files?.item(0) ?? null), {
			once: true,
		});
		input.addEventListener("cancel", () => finish(null), { once: true });
		window.addEventListener("focus", onWindowFocus, { once: true });
		document.body.append(input);
		input.click();
	});
}

function downloadFile(name: string, source: string): void {
	const url = URL.createObjectURL(new Blob([source], { type: "text/markdown;charset=utf-8" }));
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = name;
	anchor.hidden = true;
	document.body.append(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
}

async function savedDownload(
	name: string,
	source: string,
): Promise<MarkdownStorageResult<SavedMarkdownDocument>> {
	const bytes = new TextEncoder().encode(source);
	if (bytes.byteLength > maximumMarkdownDocumentBytes) return markdownStorageFailure("too-large");
	downloadFile(name, source);
	return markdownStorageSuccess({
		storageId: crypto.randomUUID(),
		name,
		fingerprint: await fingerprint(bytes.buffer),
		canOverwrite: false,
	});
}

export function createBrowserMarkdownStorage(): MarkdownDocumentStorage {
	const handles = new Map<string, BrowserFileHandle>();

	const openDocument = async (): Promise<
		MarkdownStorageResult<OpenedMarkdownDocument | null>
	> => {
		try {
			const picker = getGlobalFunction("showOpenFilePicker");
			let file: File;
			let handle: BrowserFileHandle | undefined;
			if (picker) {
				const picked = await picker({
					multiple: false,
					types: [
						{
							accept: { "text/markdown": [".md", ".markdown"] },
						},
					],
				});
				if (!Array.isArray(picked) || picked.length === 0)
					return markdownStorageSuccess(null);
				const first = picked[0];
				if (!isBrowserFileHandle(first)) return markdownStorageFailure("invalid-response");
				handle = first;
				file = await first.getFile();
			} else {
				const selected = await selectFallbackFile();
				if (!selected) return markdownStorageSuccess(null);
				file = selected;
			}

			const read = await readFile(file);
			if (!read.ok) return read;
			const storageId = crypto.randomUUID();
			handles.clear();
			if (handle) handles.set(storageId, handle);
			return markdownStorageSuccess({
				storageId,
				name: file.name,
				source: read.value.source,
				fingerprint: read.value.fingerprint,
				canOverwrite: Boolean(handle),
			});
		} catch (error) {
			if (isPickerCancellation(error)) return markdownStorageSuccess(null);
			return markdownStorageFailure("io");
		}
	};

	const saveDocument = async (
		request: SaveMarkdownDocumentRequest,
	): Promise<MarkdownStorageResult<SavedMarkdownDocument>> => {
		const bytes = new TextEncoder().encode(request.source);
		if (bytes.byteLength > maximumMarkdownDocumentBytes)
			return markdownStorageFailure("too-large");
		const handle = handles.get(request.storageId);
		if (!handle) return markdownStorageFailure("unavailable");
		try {
			const current = await readFile(await handle.getFile());
			if (!current.ok) return current;
			if (current.value.fingerprint !== request.expectedFingerprint)
				return markdownStorageFailure("conflict");
			const writable = await handle.createWritable();
			await writable.write(request.source);
			await writable.close();
			const saved = await readFile(await handle.getFile());
			if (!saved.ok) return saved;
			return markdownStorageSuccess({
				storageId: request.storageId,
				name: handle.name,
				fingerprint: saved.value.fingerprint,
				canOverwrite: true,
			});
		} catch {
			return markdownStorageFailure("io");
		}
	};

	const saveDocumentAs = async (
		request: SaveMarkdownDocumentAsRequest,
	): Promise<MarkdownStorageResult<SavedMarkdownDocument | null>> => {
		const name = normalizeMarkdownFileName(request.suggestedName);
		const bytes = new TextEncoder().encode(request.source);
		if (bytes.byteLength > maximumMarkdownDocumentBytes)
			return markdownStorageFailure("too-large");
		const picker = getGlobalFunction("showSaveFilePicker");
		if (!picker) return savedDownload(name, request.source);
		try {
			const picked = await picker({
				suggestedName: name,
				types: [
					{
						accept: { "text/markdown": [".md", ".markdown"] },
					},
				],
			});
			if (!isBrowserFileHandle(picked)) return markdownStorageFailure("invalid-response");
			if (!isMarkdownFileName(picked.name))
				return markdownStorageFailure("unsupported-extension");
			const writable = await picked.createWritable();
			await writable.write(request.source);
			await writable.close();
			const saved = await readFile(await picked.getFile());
			if (!saved.ok) return saved;
			const storageId = crypto.randomUUID();
			handles.clear();
			handles.set(storageId, picked);
			return markdownStorageSuccess({
				storageId,
				name: picked.name,
				fingerprint: saved.value.fingerprint,
				canOverwrite: true,
			});
		} catch (error) {
			if (isPickerCancellation(error)) return markdownStorageSuccess(null);
			return markdownStorageFailure("io");
		}
	};

	return { openDocument, saveDocument, saveDocumentAs };
}
