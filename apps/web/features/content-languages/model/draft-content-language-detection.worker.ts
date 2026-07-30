import { detectDraftContentLanguage } from "./detect-draft-content-language";

type DetectionRequest = {
	readonly id: number;
	readonly sample: string;
};

function isDetectionRequest(value: unknown): value is DetectionRequest {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.id === "number" &&
		Number.isSafeInteger(candidate.id) &&
		typeof candidate.sample === "string"
	);
}

self.addEventListener("message", (event: MessageEvent<unknown>) => {
	if (!isDetectionRequest(event.data)) return;
	const { id, sample } = event.data;
	self.postMessage({ id, result: detectDraftContentLanguage(sample) });
});
