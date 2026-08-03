"use client";

import { ImagePlus } from "lucide-react";
import { useFixtureInput, useFixtureSelect } from "react-cosmos/client";
import type { ReactNode } from "react";

import { useTranslation } from "@/i18n/client";
import { ImageUploadProgress, type ImageUploadStatus } from "./image-upload-progress";

const ImageUploadPhases = ["idle", "preparing", "uploading", "processing"] as const;
type ImageUploadPhase = (typeof ImageUploadPhases)[number];

function InteractiveImageUploadProgress() {
	const { t } = useTranslation(["media"]);
	const [phase] = useFixtureSelect<ImageUploadPhase>("Loading state", {
		options: [...ImageUploadPhases],
		defaultValue: "uploading",
	});
	const [progress] = useFixtureInput("Upload percentage", 42);
	const status: ImageUploadStatus = phase === "uploading" ? { phase, progress } : { phase };

	return (
		<div className="grid gap-3">
			<p className="font-medium text-sm">{t.media.displayPreview}</p>
			<div
				aria-busy={phase !== "idle"}
				className="relative grid aspect-square max-w-48 place-items-center overflow-hidden rounded-2xl border-2 border-input border-dashed bg-muted/45 text-center"
			>
				<img
					alt=""
					className="absolute inset-0 size-full object-cover"
					src="/fixtures/content-feed/post-media.svg"
				/>
				{phase === "idle" ? (
					<div className="absolute inset-0 grid place-items-center bg-black/32 text-white">
						<ImagePlus aria-hidden className="size-5" />
					</div>
				) : null}
				<ImageUploadProgress status={status} />
			</div>
		</div>
	);
}

const fixtures = {
	"Interactive loading states": <InteractiveImageUploadProgress />,
} satisfies Record<string, ReactNode>;

export default fixtures;
