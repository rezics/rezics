"use client";

import { Progress } from "@rezics/ui";

import { useTranslation } from "@/i18n/client";

export type ImageUploadStatus =
	| { readonly phase: "idle" }
	| { readonly phase: "preparing" }
	| { readonly phase: "uploading"; readonly progress: number | null }
	| { readonly phase: "processing" };

function normalizeProgress(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.min(100, Math.max(0, Math.round(value)));
}

export function ImageUploadProgress({ status }: { readonly status: ImageUploadStatus }) {
	const { t } = useTranslation(["media"]);
	if (status.phase === "idle") return null;

	const progress =
		status.phase === "uploading" && status.progress !== null
			? normalizeProgress(status.progress)
			: undefined;
	const statusText =
		status.phase === "preparing"
			? t.media.upload.preparing
			: status.phase === "processing"
				? t.media.upload.processing
				: progress === undefined
					? t.media.upload.uploading
					: t.media.upload.progress({ percentage: progress });

	return (
		<div
			aria-live="polite"
			className="absolute inset-0 z-20 grid content-center gap-3 bg-background/80 px-4 text-center backdrop-blur-sm"
			role="status"
		>
			<p className="font-medium text-foreground text-sm">{statusText}</p>
			<Progress aria-label={statusText} indeterminate={progress === undefined} value={progress} />
		</div>
	);
}
