import { AsyncLocalStorage } from "node:async_hooks";
type DocumentPath = { sourceRecordId: string; snapshotId: string; prefix: "" | "/parts/native_view" };
const documents = new AsyncLocalStorage<readonly DocumentPath[]>();

/** @internal Called only by the issued archive receipt owner after resolving its committed snapshot. */
export function withSourceDocumentPaths<T>(input: readonly DocumentPath[], work: () => T): T {
	const all = new Map((documents.getStore() ?? []).map((document) => [`${document.sourceRecordId}:${document.snapshotId}`, document]));
	for (const document of input) all.set(`${document.sourceRecordId}:${document.snapshotId}`, document);
	if (all.size > 8) throw new RangeError("Source evidence scope exceeds eight snapshots");
	return documents.run([...all.values()], work);
}
function prefix(sourceRecordId: string, snapshotId: string) { return documents.getStore()?.find((document) => document.sourceRecordId === sourceRecordId && document.snapshotId === snapshotId)?.prefix ?? ""; }
/** @internal Persist the actual archived part and its JSON pointer. */
export function catalogSourcePath(sourceRecordId: string, snapshotId: string, path: string) {
	const part = prefix(sourceRecordId, snapshotId);
	if (!part || path === part || path.startsWith(`${part}/`)) return path;
	const result = `${part}${path === "/" ? "" : path}`;
	if (!path.startsWith("/") || Buffer.byteLength(result) > 512) throw new TypeError("Source part pointer exceeds its path budget");
	return result;
}
/** @internal Logical slot matching leaves physical persisted evidence paths intact. */
export function catalogSourceLogicalPath(sourceRecordId: string, snapshotId: string, path: string) {
	const part = prefix(sourceRecordId, snapshotId);
	return part && (path === part || path.startsWith(`${part}/`)) ? path.slice(part.length) || "/" : path;
}
