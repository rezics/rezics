"use client";
import { StatusCodes } from "http-status-codes";

import {
	useDeleteApiImageAssetsById,
	usePostApiImageAssets,
	usePostApiImageAssetsByIdComplete,
} from "@rezics/openapi-tanstack-query";
import { ImagePlus, RefreshCw, Trash2, UploadCloud, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
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

export type LocalizationImageRole = "avatar" | "banner" | "cover";
export type LocalizationImageShape = "avatar" | "banner" | "landscape" | "portrait";

export interface LocalizationImageAssetValue {
	id: string;
	url: string;
}

export interface LocalizationImageAssetOption extends LocalizationImageAssetValue {
	label: string;
}

const AcceptedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export function LocalizationImageUploadField({
	value,
	onChange,
	fallback = null,
	options = [],
	role,
	shape,
}: {
	value: LocalizationImageAssetValue | null;
	onChange: (value: LocalizationImageAssetValue | null) => void;
	fallback?: LocalizationImageAssetValue | null;
	options?: readonly LocalizationImageAssetOption[];
	role: LocalizationImageRole;
	shape: LocalizationImageShape;
}) {
	const { t } = useTranslation({ suspense: true });
	const copy = t.media.roles[role];
	const requestUpload = usePostApiImageAssets();
	const completeUpload = usePostApiImageAssetsByIdComplete();
	const deleteUpload = useDeleteApiImageAssetsById();
	const xhr = useRef<XMLHttpRequest | null>(null);
	const [files, setFiles] = useState<File[]>([]);
	const [preview, setPreview] = useState<string>();
	const [progress, setProgress] = useState(0);
	const [error, setError] = useState<string>();
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
			<FileUploadDropzone
				className={cn(
					"group bg-muted/45 relative grid max-w-md place-items-center overflow-hidden border-dashed p-0 transition-colors",
					shape === "avatar"
						? "aspect-square max-w-48 rounded-full"
						: shape === "banner"
							? "aspect-[3/1] max-w-2xl"
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
			<div className="flex flex-wrap gap-2">
				<FileUploadTrigger asChild>
					<Button disabled={busy} size="sm" type="button" variant="outline">
						{displayed ? (
							<RefreshCw aria-hidden className="size-3.5" />
						) : (
							<UploadCloud aria-hidden className="size-3.5" />
						)}
						{displayed ? t.media.replace : copy.upload}
					</Button>
				</FileUploadTrigger>
				{busy && (
					<Button
						onClick={() => xhr.current?.abort()}
						size="sm"
						type="button"
						variant="ghost"
					>
						<X aria-hidden className="size-3.5" />
						{t.media.cancel}
					</Button>
				)}
				{value && (
					<Button onClick={remove} size="sm" type="button" variant="ghost">
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
