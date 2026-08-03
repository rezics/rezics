"use client";

import { StatusCodes } from "http-status-codes";

import {
	useDeleteApiImageAssetsById,
	usePostApiImageAssets,
	usePostApiImageAssetsByIdComplete,
} from "@rezics/openapi-tanstack-query";
import { ImagePlus, RefreshCw, Scan, Trash2, X } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";

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
	cn,
} from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { getErrorStatus } from "@/i18n/errors";
import type { ImageAssetPresentationRole } from "../model/image-asset-presentation";
import {
	ImageUploadContentTypes,
	MaximumImageUploadBytes,
	validateImageUploadCandidate,
} from "../model/image-upload";
import { ImageUploadProgress, type ImageUploadStatus } from "./image-upload-progress";

const ImageAssetPresentationEditor = lazy(() =>
	import("./image-asset-presentation-editor").then(({ ImageAssetPresentationEditor }) => ({
		default: ImageAssetPresentationEditor,
	})),
);

export type LocalizationImageRole = ImageAssetPresentationRole;

export interface LocalizationImageAssetValue {
	id: string;
	url: string;
}

export interface LocalizationImageAssetOption extends LocalizationImageAssetValue {
	label: string;
}

type LocalizationImageUploadFieldProps = {
	value: LocalizationImageAssetValue | null;
	onChange: (value: LocalizationImageAssetValue | null) => void;
	fallback?: LocalizationImageAssetValue | null;
	options?: readonly LocalizationImageAssetOption[];
	allowRemove?: boolean;
	onPresentationSaved?: () => void;
	role: LocalizationImageRole;
};

export function LocalizationImageUploadField({
	value,
	onChange,
	fallback = null,
	options = [],
	allowRemove = true,
	onPresentationSaved,
	role,
}: LocalizationImageUploadFieldProps) {
	const { t } = useTranslation(["media"]);
	const copy = t.media.roles[role];
	const requestUpload = usePostApiImageAssets();
	const completeUpload = usePostApiImageAssetsByIdComplete();
	const deleteUpload = useDeleteApiImageAssetsById();
	const xhr = useRef<XMLHttpRequest | null>(null);
	const [files, setFiles] = useState<File[]>([]);
	const [preview, setPreview] = useState<string>();
	const [uploadStatus, setUploadStatus] = useState<ImageUploadStatus>({ phase: "idle" });
	const [error, setError] = useState<string>();
	const [editorAssetId, setEditorAssetId] = useState<string>();
	const [editorOpen, setEditorOpen] = useState(false);
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
		const validation = validateImageUploadCandidate(file);
		if (!validation.ok) {
			setError(t.media.invalid);
			return;
		}
		if (preview) URL.revokeObjectURL(preview);
		setPreview(URL.createObjectURL(file));
		setUploadStatus({ phase: "preparing" });
		let assetId: string | undefined;
		try {
			const asset = await requestUpload.mutateAsync({
				body: {
					contentType: validation.contentType,
					size: file.size,
					access: "public",
				},
			});
			assetId = asset.id;
			setUploadStatus({ phase: "uploading", progress: null });
			await uploadFile(
				asset.upload.url,
				asset.upload.headers,
				file,
				(progress) => setUploadStatus({ phase: "uploading", progress }),
				xhr,
			);
			setUploadStatus({ phase: "processing" });
			const completed = await completeUpload.mutateAsync({
				path: { id: asset.id },
				body: { role },
			});
			const presentation = completed.presentations.find((item) => item.role === role);
			if (!presentation) throw new Error("Completed image has no requested presentation");
			if (preview) URL.revokeObjectURL(preview);
			setPreview(undefined);
			onChange({ id: completed.id, url: presentation.contentUrl });
			setEditorAssetId(completed.id);
			setEditorOpen(true);
		} catch (caught) {
			if (assetId)
				await deleteUpload.mutateAsync({ path: { id: assetId } }).catch(() => undefined);
			const status = getErrorStatus(caught);
			setError(
				status === StatusCodes.UNPROCESSABLE_ENTITY ||
					status === StatusCodes.UNSUPPORTED_MEDIA_TYPE ||
					status === StatusCodes.REQUEST_TOO_LONG
					? t.media.invalid
					: copy.failed,
			);
		} finally {
			setUploadStatus({ phase: "idle" });
			setFiles([]);
		}
	}

	function remove() {
		xhr.current?.abort();
		onChange(null);
		setUploadStatus({ phase: "idle" });
		setFiles([]);
		if (preview) URL.revokeObjectURL(preview);
		setPreview(undefined);
		setError(undefined);
	}

	const busy = uploadStatus.phase !== "idle";
	const valueIsReusableOption = options.some((option) => option.id === value?.id);
	return (
		<FileUpload
			accept={ImageUploadContentTypes.join(",")}
			acceptedFiles={files}
			aria-busy={busy}
			className="grid gap-2"
			disabled={busy}
			maxFileSize={MaximumImageUploadBytes}
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
			{displayed ? (
				<p className="font-medium text-foreground text-sm">{t.media.displayPreview}</p>
			) : null}
			<FileUploadDropzone
				className={cn(
					"group bg-muted/45 relative grid max-w-md place-items-center overflow-hidden border-dashed p-0 transition-colors",
					role === "avatar"
						? "aspect-square max-w-48"
						: role === "banner"
							? "aspect-[4/1] max-w-2xl"
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
					role === "cover" ? (
						<Cover alt="" className="size-full rounded-none" src={displayed} />
					) : role === "banner" ? (
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
				<ImageUploadProgress status={uploadStatus} />
			</FileUploadDropzone>
			{displayed && role === "banner" ? (
				<p className="max-w-2xl text-muted-foreground text-xs leading-5">
					{t.media.bannerPreview.description}
				</p>
			) : null}
			<div className="flex flex-wrap gap-2">
				{value ? (
					<Button
						onClick={() => {
							setEditorAssetId(value.id);
							setEditorOpen(true);
						}}
						size="sm"
						type="button"
						variant="outline"
					>
						<Scan aria-hidden className="size-3.5" />
						{t.media.editPresentation}
					</Button>
				) : null}
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
			{editorAssetId ? (
				<Suspense
					fallback={
						<p className="text-muted-foreground text-sm">
							{t.media.presentationEditor.loading}
						</p>
					}
				>
					<ImageAssetPresentationEditor
						assetId={editorAssetId}
						onOpenChange={setEditorOpen}
						onSaved={(asset) => {
							onChange(asset);
							onPresentationSaved?.();
						}}
						open={editorOpen}
						role={role}
					/>
				</Suspense>
			) : null}
		</FileUpload>
	);
}

function uploadFile(
	url: string,
	headers: Record<string, string>,
	file: File,
	progress: (value: number | null) => void,
	reference: React.MutableRefObject<XMLHttpRequest | null>,
) {
	return new Promise<void>((resolve, reject) => {
		const request = new XMLHttpRequest();
		reference.current = request;
		request.open("PUT", url);
		for (const [name, value] of Object.entries(headers)) request.setRequestHeader(name, value);
		request.upload.onprogress = (event) => {
			if (!event.lengthComputable || event.total <= 0) {
				progress(null);
				return;
			}
			progress(Math.min(100, Math.max(0, Math.round((event.loaded / event.total) * 100))));
		};
		request.onload = () =>
			request.status >= StatusCodes.OK && request.status < StatusCodes.MULTIPLE_CHOICES
				? resolve()
				: reject(new Error("Upload failed"));
		request.onerror = reject;
		request.onabort = reject;
		request.send(file);
	});
}
