"use client";
import { StatusCodes } from "http-status-codes";

import {
	useDeleteApiImageAssetsById,
	usePostApiImageAssets,
	usePostApiImageAssetsByIdComplete,
} from "@rezics/openapi-tanstack-query";
import { Eye, EyeOff, ImagePlus, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import {
	Banner,
	Button,
	Cover,
	FileUpload,
	FileUploadDropzone,
	FileUploadDropzoneIcon,
	FileUploadHelper,
	FileUploadTitle,
	FileUploadTrigger,
	NativeSelect,
	NativeSelectOption,
	Progress,
	ProgressValue,
	cn,
} from "@rezics/ui";
import { useTranslation } from "@/i18n/client";

export type LocalizationImagePresentation =
	| { role: "avatar"; shape: "avatar" }
	| { role: "banner"; shape: "banner" }
	| { role: "cover"; shape: "landscape" | "portrait" };

export type LocalizationImageRole = LocalizationImagePresentation["role"];
export type LocalizationImageShape = LocalizationImagePresentation["shape"];

export interface LocalizationImageAssetValue {
	id: string;
	url: string;
}

export interface LocalizationImageAssetOption extends LocalizationImageAssetValue {
	label: string;
}

type LocalizationImageUploadFieldProps = LocalizationImagePresentation & {
	value: LocalizationImageAssetValue | null;
	onChange: (value: LocalizationImageAssetValue | null) => void;
	fallback?: LocalizationImageAssetValue | null;
	options?: readonly LocalizationImageAssetOption[];
	allowRemove?: boolean;
};

const AcceptedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export function LocalizationImageUploadField({
	value,
	onChange,
	fallback = null,
	options = [],
	allowRemove = true,
	role,
	shape,
}: LocalizationImageUploadFieldProps) {
	const { t } = useTranslation(["media"]);
	const copy = t.media.roles[role];
	const requestUpload = usePostApiImageAssets();
	const completeUpload = usePostApiImageAssetsByIdComplete();
	const deleteUpload = useDeleteApiImageAssetsById();
	const xhr = useRef<XMLHttpRequest | null>(null);
	const [files, setFiles] = useState<File[]>([]);
	const [preview, setPreview] = useState<string>();
	const [showOriginal, setShowOriginal] = useState(false);
	const [progress, setProgress] = useState(0);
	const [error, setError] = useState<string>();
	const originalPreviewId = useId();
	const displayed = preview ?? value?.url ?? fallback?.url;

	useEffect(
		() => () => {
			if (preview) URL.revokeObjectURL(preview);
			xhr.current?.abort();
		},
		[preview],
	);

	async function choose(file?: File) {
		if (!file) return;
		setError(undefined);
		setShowOriginal(false);
		if (!AcceptedTypes.includes(file.type) || file.size > 10_485_760) {
			setError(t.media.invalid);
			return;
		}
		if (preview) URL.revokeObjectURL(preview);
		setPreview(URL.createObjectURL(file));
		let assetId: string | undefined;
		try {
			const asset = await requestUpload.mutateAsync({
				body: { contentType: file.type, size: file.size, access: "public" },
			});
			assetId = asset.id;
			await uploadFile(asset.upload.url, asset.upload.headers, file, setProgress, xhr);
			const completed = await completeUpload.mutateAsync({ path: { id: asset.id } });
			onChange({ id: completed.id, url: completed.contentUrl });
		} catch {
			if (assetId)
				await deleteUpload.mutateAsync({ path: { id: assetId } }).catch(() => undefined);
			setError(copy.failed);
			setProgress(0);
		} finally {
			setFiles([]);
		}
	}

	function remove() {
		xhr.current?.abort();
		onChange(null);
		setProgress(0);
		setFiles([]);
		setShowOriginal(false);
		if (preview) URL.revokeObjectURL(preview);
		setPreview(undefined);
		setError(undefined);
	}

	const busy =
		requestUpload.isPending || completeUpload.isPending || (progress > 0 && progress < 100);
	const valueIsReusableOption = options.some((option) => option.id === value?.id);
	return (
		<FileUpload
			accept={AcceptedTypes.join(",")}
			acceptedFiles={files}
			className="grid gap-2"
			disabled={busy}
			maxFileSize={10_485_760}
			maxFiles={1}
			onFileAccept={({ files }) => void choose(files[0])}
			onFileChange={({ acceptedFiles }) => setFiles(acceptedFiles)}
			onFileReject={() => setError(t.media.invalid)}
		>
			{options.length > 0 && (
				<NativeSelect
					value={value?.id ?? ""}
					onChange={(event) => {
						const selected = options.find(({ id }) => id === event.currentTarget.value);
						onChange(selected ? { id: selected.id, url: selected.url } : null);
						setPreview(undefined);
						setShowOriginal(false);
					}}
				>
					<NativeSelectOption value="">{copy.inherit}</NativeSelectOption>
					{value && !valueIsReusableOption ? (
						<NativeSelectOption value={value.id}>{t.media.current}</NativeSelectOption>
					) : null}
					{options.map((option) => (
						<NativeSelectOption key={`${option.label}:${option.id}`} value={option.id}>
							{option.label}
						</NativeSelectOption>
					))}
				</NativeSelect>
			)}
			{displayed ? (
				<p className="font-medium text-foreground text-sm">{t.media.displayPreview}</p>
			) : null}
			<FileUploadDropzone
				className={cn(
					"group bg-muted/45 relative grid max-w-md place-items-center overflow-hidden border-dashed p-0 transition-colors",
					shape === "avatar"
						? "aspect-square max-w-48 rounded-full"
						: shape === "banner"
							? "aspect-[4/1] max-w-2xl"
							: shape === "landscape"
								? "aspect-video"
								: "aspect-[3/4] max-h-96",
				)}
				disableClick={Boolean(displayed)}
				onPaste={(event) => {
					const file = Array.from(event.clipboardData.files).find(({ type }) =>
						type.startsWith("image/"),
					);
					if (file) void choose(file);
				}}
			>
				{displayed ? (
					shape === "portrait" ? (
						<Cover alt="" className="size-full rounded-none" src={displayed} />
					) : shape === "banner" ? (
						<Banner alt="" className="size-full rounded-none" src={displayed} />
					) : (
						<img alt="" className="size-full object-cover" src={displayed} />
					)
				) : (
					<>
						<FileUploadDropzoneIcon>
							<ImagePlus aria-hidden className="size-5" />
						</FileUploadDropzoneIcon>
						<FileUploadTitle>{t.media.choose}</FileUploadTitle>
						<FileUploadHelper>{t.media.hint}</FileUploadHelper>
					</>
				)}
				{busy && (
					<div className="bg-background/80 absolute inset-x-0 bottom-0 p-2 backdrop-blur">
						<Progress value={progress}>
							<ProgressValue className="text-xs" />
						</Progress>
					</div>
				)}
			</FileUploadDropzone>
			{displayed && shape === "banner" ? (
				<div className="grid max-w-2xl gap-2">
					<p className="text-muted-foreground text-xs leading-5">
						{t.media.bannerPreview.description}
					</p>
					<Button
						aria-controls={originalPreviewId}
						aria-expanded={showOriginal}
						className="w-fit"
						onClick={() => setShowOriginal((visible) => !visible)}
						size="sm"
						type="button"
						variant="quiet"
					>
						{showOriginal ? (
							<EyeOff aria-hidden className="size-3.5" />
						) : (
							<Eye aria-hidden className="size-3.5" />
						)}
						{showOriginal
							? t.media.bannerPreview.hideOriginal
							: t.media.bannerPreview.showOriginal}
					</Button>
					{showOriginal ? (
						<div
							className="grid gap-2 rounded-xl border bg-muted/30 p-3"
							id={originalPreviewId}
						>
							<p className="font-medium text-foreground text-xs">
								{t.media.bannerPreview.original}
							</p>
							<div className="flex max-h-80 justify-center overflow-hidden rounded-lg bg-surface-container">
								<div className="relative inline-block max-h-72 max-w-full overflow-hidden">
									<img
										alt=""
										className="block max-h-72 max-w-full object-contain"
										src={displayed}
									/>
									<div
										aria-hidden
										className="pointer-events-none absolute inset-x-0 top-1/2 aspect-[4/1] -translate-y-1/2 border-2 border-primary shadow-[0_0_0_9999px_rgb(0_0_0/0.5)]"
									/>
								</div>
							</div>
						</div>
					) : null}
				</div>
			) : null}
			<div className="flex flex-wrap gap-2">
				{displayed && (
					<FileUploadTrigger asChild>
						<Button disabled={busy} size="sm" type="button" variant="outline">
							<RefreshCw aria-hidden className="size-3.5" />
							{t.media.replace}
						</Button>
					</FileUploadTrigger>
				)}
				{busy && (
					<Button
						onClick={() => xhr.current?.abort()}
						size="sm"
						type="button"
						variant="quiet"
					>
						<X aria-hidden className="size-3.5" />
						{t.media.cancel}
					</Button>
				)}
				{value && allowRemove && (
					<Button onClick={remove} size="sm" type="button" variant="quiet">
						<Trash2 aria-hidden className="size-3.5" />
						{t.media.remove}
					</Button>
				)}
			</div>
			{error && <p className="text-destructive text-sm">{error}</p>}
		</FileUpload>
	);
}

function uploadFile(
	url: string,
	headers: Record<string, string>,
	file: File,
	progress: (value: number) => void,
	reference: React.MutableRefObject<XMLHttpRequest | null>,
) {
	return new Promise<void>((resolve, reject) => {
		const request = new XMLHttpRequest();
		reference.current = request;
		request.open("PUT", url);
		for (const [name, value] of Object.entries(headers)) request.setRequestHeader(name, value);
		request.upload.onprogress = (event) =>
			event.lengthComputable && progress(Math.round((event.loaded / event.total) * 100));
		request.onload = () =>
			request.status >= StatusCodes.OK && request.status < StatusCodes.MULTIPLE_CHOICES
				? resolve()
				: reject(new Error("Upload failed"));
		request.onerror = reject;
		request.onabort = reject;
		request.send(file);
	});
}
