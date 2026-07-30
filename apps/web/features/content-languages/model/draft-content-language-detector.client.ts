import { isContentLanguage } from "@rezics/i18n";

import type { DraftContentLanguageDetection } from "./detect-draft-content-language";
import DraftContentLanguageDetectionWorker from "./draft-content-language-detection.worker?worker";

type PendingDetection = {
	readonly reject: (reason: unknown) => void;
	readonly resolve: (result: DraftContentLanguageDetection) => void;
};

type DetectionResponse = {
	readonly id: number;
	readonly result: DraftContentLanguageDetection;
};

function isDetectionResponse(value: unknown): value is DetectionResponse {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value as Record<string, unknown>;
	if (typeof candidate.id !== "number" || !Number.isSafeInteger(candidate.id)) return false;
	const result = candidate.result;
	if (typeof result !== "object" || result === null) return false;
	const detection = result as Record<string, unknown>;
	if (detection.status === "detected")
		return typeof detection.language === "string" && isContentLanguage(detection.language);
	return (
		detection.status === "insufficient" ||
		detection.status === "ambiguous" ||
		detection.status === "unsupported"
	);
}

let nextRequestId = 0;
let worker: Worker | undefined;
const pendingDetections = new Map<number, PendingDetection>();

function rejectPendingDetections(reason: unknown): void {
	for (const pending of pendingDetections.values()) pending.reject(reason);
	pendingDetections.clear();
}

function getDetectionWorker(): Worker | undefined {
	if (typeof Worker === "undefined") return undefined;
	if (worker) return worker;
	worker = new DraftContentLanguageDetectionWorker();
	worker.addEventListener("message", (event: MessageEvent<unknown>) => {
		if (!isDetectionResponse(event.data)) {
			rejectPendingDetections(new Error("Invalid language detection worker response."));
			worker?.terminate();
			worker = undefined;
			return;
		}
		const pending = pendingDetections.get(event.data.id);
		if (!pending) return;
		pendingDetections.delete(event.data.id);
		pending.resolve(event.data.result);
	});
	worker.addEventListener("error", (event) => {
		rejectPendingDetections(event.error ?? new Error(event.message));
		worker?.terminate();
		worker = undefined;
	});
	return worker;
}

export async function detectDraftContentLanguageInBrowser(
	sample: string,
	signal: AbortSignal,
): Promise<DraftContentLanguageDetection> {
	if (signal.aborted) throw signal.reason;
	const detectionWorker = getDetectionWorker();
	if (!detectionWorker) {
		const { detectDraftContentLanguage } = await import("./detect-draft-content-language");
		if (signal.aborted) throw signal.reason;
		return detectDraftContentLanguage(sample);
	}

	const id = ++nextRequestId;
	return new Promise<DraftContentLanguageDetection>((resolve, reject) => {
		const abort = () => {
			pendingDetections.delete(id);
			reject(signal.reason);
		};
		pendingDetections.set(id, {
			resolve: (result) => {
				signal.removeEventListener("abort", abort);
				resolve(result);
			},
			reject: (reason) => {
				signal.removeEventListener("abort", abort);
				reject(reason);
			},
		});
		signal.addEventListener("abort", abort, { once: true });
		detectionWorker.postMessage({ id, sample });
	});
}
