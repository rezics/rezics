"use client";
import { StatusCodes } from "http-status-codes";

import {
	useDeleteApiUploads,
	usePostApiUploads,
	usePostApiUploadsComplete,
} from "@rezics/openapi-tanstack-query";
import { ImagePlus, RefreshCw, Trash2, UploadCloud, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
	Button,
	FileUpload,
	FileUploadDropzone,
	FileUploadDropzoneIcon,
	FileUploadHelper,
	FileUploadTitle,
	FileUploadTrigger,
	Progress,
	ProgressValue,
	cn,
} from "@rezics/ui";
import { useTranslation } from "@/i18n/client";

export interface CoverAssetValue {
	key: string;
	focalPoint: { x: number; y: number };
}

const AcceptedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export function CoverUploadField({
	value,
	onChange,
	landscape = false,
}: {
	value: CoverAssetValue | null;
	onChange: (value: CoverAssetValue | null) => void;
	landscape?: boolean;
}) {
	const { t } = useTranslation({ suspense: true });
	const requestUpload = usePostApiUploads();
	const completeUpload = usePostApiUploadsComplete();
	const deleteUpload = useDeleteApiUploads();
	const xhr = useRef<XMLHttpRequest | null>(null);
	const [files, setFiles] = useState<File[]>([]);
	const [preview, setPreview] = useState<string>();
	const [progress, setProgress] = useState(0);
	const [error, setError] = useState<string>();

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
			setError(t.cover.invalid);
			return;
		}
		if (preview) URL.revokeObjectURL(preview);
		setPreview(URL.createObjectURL(file));
		let key: string | undefined;
		try {
			const upload = await requestUpload.mutateAsync({
				body: { filename: file.name, contentType: file.type, size: file.size },
			});
			key = upload.key;
			await uploadFile(upload.url, file, setProgress, xhr);
			await completeUpload.mutateAsync({ body: { key } });
			onChange({ key, focalPoint: { x: 0.5, y: 0.5 } });
		} catch {
			if (key) await deleteUpload.mutateAsync({ body: { key } }).catch(() => undefined);
			setError(t.cover.failed);
			setProgress(0);
		} finally {
			setFiles([]);
		}
	}

	async function remove() {
		xhr.current?.abort();
		if (value?.key)
			await deleteUpload.mutateAsync({ body: { key: value.key } }).catch(() => undefined);
		onChange(null);
		setProgress(0);
		setFiles([]);
		setPreview(undefined);
		setError(undefined);
	}

	const busy =
		requestUpload.isPending || completeUpload.isPending || (progress > 0 && progress < 100);
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
			onFileReject={() => setError(t.cover.invalid)}
		>
			<FileUploadDropzone
				className={cn(
					"group bg-muted/45 relative grid max-w-md place-items-center overflow-hidden border-dashed p-0 transition-colors",
					landscape ? "aspect-video" : "aspect-[2/3] max-h-96",
				)}
				disableClick={Boolean(preview)}
				onPaste={(event) => {
					const file = Array.from(event.clipboardData.files).find(({ type }) =>
						type.startsWith("image/"),
					);
					if (file) void choose(file);
				}}
			>
				{preview ? (
					<Button
						aria-label={t.cover.focal}
						className="absolute inset-0 size-full rounded-none p-0 hover:bg-transparent"
						onClick={(event) => {
							if (!value) return;
							const box = event.currentTarget.getBoundingClientRect();
							onChange({
								...value,
								focalPoint: {
									x: (event.clientX - box.left) / box.width,
									y: (event.clientY - box.top) / box.height,
								},
							});
						}}
						type="button"
						variant="ghost"
					>
						<img
							alt=""
							className="size-full object-cover"
							src={preview}
							style={{
								objectPosition: `${(value?.focalPoint.x ?? 0.5) * 100}% ${(value?.focalPoint.y ?? 0.5) * 100}%`,
							}}
						/>
						{value && (
							<span
								className="ring-primary pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary/35 ring-1"
								style={{
									left: `${value.focalPoint.x * 100}%`,
									top: `${value.focalPoint.y * 100}%`,
								}}
							/>
						)}
					</Button>
				) : (
					<>
						<FileUploadDropzoneIcon>
							<ImagePlus aria-hidden className="size-5" />
						</FileUploadDropzoneIcon>
						<FileUploadTitle>{t.cover.choose}</FileUploadTitle>
						<FileUploadHelper>{t.cover.hint}</FileUploadHelper>
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
						{value ? (
							<RefreshCw aria-hidden className="size-3.5" />
						) : (
							<UploadCloud aria-hidden className="size-3.5" />
						)}
						{value ? t.cover.replace : t.cover.upload}
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
						{t.cover.cancel}
					</Button>
				)}
				{(value || preview) && (
					<Button onClick={() => void remove()} size="sm" type="button" variant="ghost">
						<Trash2 aria-hidden className="size-3.5" />
						{t.cover.remove}
					</Button>
				)}
			</div>
			{error && <p className="text-destructive text-sm">{error}</p>}
			{value && <p className="text-muted-foreground text-xs">{t.cover.focalHint}</p>}
		</FileUpload>
	);
}

function uploadFile(
	url: string,
	file: File,
	progress: (value: number) => void,
	reference: React.MutableRefObject<XMLHttpRequest | null>,
) {
	return new Promise<void>((resolve, reject) => {
		const request = new XMLHttpRequest();
		reference.current = request;
		request.open("PUT", url);
		request.setRequestHeader("Content-Type", file.type);
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
