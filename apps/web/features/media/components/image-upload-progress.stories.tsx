import { expect } from "storybook/test";
import preview from "@/.storybook/preview";
import { useTranslation } from "@/i18n/client";
import { ImageUploadProgress, type ImageUploadStatus } from "./image-upload-progress";

const meta = preview.meta({
	component: ImageUploadProgress,
	tags: ["ai-generated"],
	args: { status: { phase: "uploading", progress: 42 } satisfies ImageUploadStatus },
	render: function Render(args) {
		const { t } = useTranslation(["media"]);
		return (
			<div className="grid gap-3">
				<p className="font-medium text-sm">{t.media.displayPreview}</p>
				<div
					className="relative aspect-square w-48 overflow-hidden rounded-2xl"
					aria-busy={args.status.phase !== "idle"}
				>
					<img
						alt=""
						className="size-full object-cover"
						src="/fixtures/content-feed/post-media.svg"
					/>
					<ImageUploadProgress {...args} />
				</div>
			</div>
		);
	},
});
export default meta;

export const Uploading = meta.story({
	play: async ({ canvas }) => {
		await expect(canvas.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "42");
	},
});
export const Idle = meta.story({ args: { status: { phase: "idle" } } });
export const Preparing = meta.story({ args: { status: { phase: "preparing" } } });
export const Processing = meta.story({ args: { status: { phase: "processing" } } });
export const Indeterminate = meta.story({
	args: { status: { phase: "uploading", progress: null } },
});
export const CompletedUpload = meta.story({
	args: { status: { phase: "uploading", progress: 100 } },
});
