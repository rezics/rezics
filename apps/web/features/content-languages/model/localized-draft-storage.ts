const LocalizedDraftDatabaseName = "rezics-authoring";
const LocalizedDraftDatabaseVersion = 1;
const LocalizedDraftStoreName = "localized-drafts";
const LocalizedDraftLifetimeMilliseconds = 30 * 24 * 60 * 60 * 1_000;

export interface StoredLocalizedDraft {
	readonly key: string;
	readonly schemaVersion: number;
	readonly baseVersion: string | null;
	readonly value: unknown;
	readonly updatedAt: number;
	readonly expiresAt: number;
}

type ScheduledDraft = {
	readonly timer: ReturnType<typeof setTimeout>;
	readonly record: StoredLocalizedDraft;
};

const scheduledDrafts = new Map<string, ScheduledDraft>();
let databasePromise: Promise<IDBDatabase> | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStoredLocalizedDraft(value: unknown): StoredLocalizedDraft | undefined {
	if (!isRecord(value)) return;
	if (
		typeof value.key !== "string" ||
		typeof value.schemaVersion !== "number" ||
		!Number.isSafeInteger(value.schemaVersion) ||
		value.schemaVersion < 1 ||
		!(typeof value.baseVersion === "string" || value.baseVersion === null) ||
		typeof value.updatedAt !== "number" ||
		!Number.isFinite(value.updatedAt) ||
		typeof value.expiresAt !== "number" ||
		!Number.isFinite(value.expiresAt)
	)
		return;
	return {
		key: value.key,
		schemaVersion: value.schemaVersion,
		baseVersion: value.baseVersion,
		value: value.value,
		updatedAt: value.updatedAt,
		expiresAt: value.expiresAt,
	};
}

function openLocalizedDraftDatabase(): Promise<IDBDatabase> {
	if (databasePromise) return databasePromise;
	const pending = new Promise<IDBDatabase>((resolve, reject) => {
		const request = indexedDB.open(LocalizedDraftDatabaseName, LocalizedDraftDatabaseVersion);
		request.addEventListener("upgradeneeded", () => {
			const database = request.result;
			if (!database.objectStoreNames.contains(LocalizedDraftStoreName))
				database.createObjectStore(LocalizedDraftStoreName, { keyPath: "key" });
		});
		request.addEventListener("success", () => {
			const database = request.result;
			database.addEventListener("versionchange", () => database.close());
			resolve(database);
		});
		request.addEventListener("error", () => reject(request.error));
		request.addEventListener("blocked", () => {
			request.addEventListener("success", () => request.result.close(), { once: true });
			reject(new Error("Localized draft database upgrade was blocked"));
		});
	}).catch((error: unknown) => {
		databasePromise = undefined;
		throw error;
	});
	databasePromise = pending;
	return pending;
}

function indexedDraftStorageAvailable(): boolean {
	return typeof indexedDB !== "undefined";
}

async function transact<Result>(
	mode: IDBTransactionMode,
	operation: (store: IDBObjectStore) => IDBRequest<Result>,
): Promise<Result> {
	const database = await openLocalizedDraftDatabase();
	return new Promise((resolve, reject) => {
		const transaction = database.transaction(LocalizedDraftStoreName, mode);
		const request = operation(transaction.objectStore(LocalizedDraftStoreName));
		let result: { readonly state: "pending" } | { readonly state: "ready"; value: Result } = {
			state: "pending",
		};
		request.addEventListener("success", () => {
			result = { state: "ready", value: request.result };
		});
		request.addEventListener("error", () => reject(request.error));
		transaction.addEventListener("abort", () => reject(transaction.error));
		transaction.addEventListener("complete", () => {
			if (result.state === "ready") resolve(result.value);
			else reject(new Error("Localized draft transaction completed without a result"));
		});
	});
}

export async function readStoredLocalizedDraft(
	key: string,
): Promise<StoredLocalizedDraft | undefined> {
	if (!indexedDraftStorageAvailable()) return;
	try {
		const draft = parseStoredLocalizedDraft(
			await transact("readonly", (store) => store.get(key)),
		);
		if (!draft) return;
		if (draft.expiresAt > Date.now()) return draft;
		await removeStoredLocalizedDraft(key);
	} catch {
		// In-memory drafts remain available when private mode or quota policy blocks IndexedDB.
	}
	return undefined;
}

async function writeStoredLocalizedDraft(record: StoredLocalizedDraft): Promise<void> {
	if (!indexedDraftStorageAvailable()) return;
	try {
		await transact("readwrite", (store) => store.put(record));
	} catch {
		// Editing must remain usable when durable browser storage is unavailable.
	}
}

export function scheduleStoredLocalizedDraft(
	record: Omit<StoredLocalizedDraft, "updatedAt" | "expiresAt">,
): void {
	const current = scheduledDrafts.get(record.key);
	if (current) clearTimeout(current.timer);
	const now = Date.now();
	const stored: StoredLocalizedDraft = {
		...record,
		updatedAt: now,
		expiresAt: now + LocalizedDraftLifetimeMilliseconds,
	};
	const timer = setTimeout(() => {
		scheduledDrafts.delete(record.key);
		void writeStoredLocalizedDraft(stored);
	}, 250);
	scheduledDrafts.set(record.key, { timer, record: stored });
}

export async function removeStoredLocalizedDraft(key: string): Promise<void> {
	const scheduled = scheduledDrafts.get(key);
	if (scheduled) {
		clearTimeout(scheduled.timer);
		scheduledDrafts.delete(key);
	}
	if (!indexedDraftStorageAvailable()) return;
	try {
		await transact("readwrite", (store) => store.delete(key));
	} catch {
		// The in-memory copy is still removed by the caller.
	}
}
