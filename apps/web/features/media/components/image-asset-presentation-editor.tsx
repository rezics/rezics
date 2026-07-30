"use client";

import {
	useGetApiImageAssetsById,
	usePutApiImageAssetsByIdPresentationsByRole,
} from "@rezics/openapi-tanstack-query";
import {
	Button,
	Cover,
	Dialog,
	DialogBody,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Field,
	FieldLabel,
	NativeSelect,
	NativeSelectOption,
	Slider,
	SliderLabel,
	Spinner,
	cn,
} from "@rezics/ui";
import { Minus, Plus, RotateCcw, X } from "lucide-react";
import {
	type KeyboardEvent,
	type PointerEvent,
	type WheelEvent,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { useTranslation } from "@/i18n/client";
import {
	clampNormalizedImageCrop,
	defaultNormalizedImageCrop,
	type ImageAssetPresentationRole,
	type NormalizedImageCrop,
} from "../model/image-asset-presentation";

interface ImageAssetPresentationEditorProps {
	readonly assetId: string;
	readonly onOpenChange: (open: boolean) => void;
	readonly onSaved: (value: { readonly id: string; readonly url: string }) => void;
	readonly open: boolean;
	readonly role: ImageAssetPresentationRole;
}

function positiveInteger(value: string | number | null): number | null {
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function cropImageStyle(crop: NormalizedImageCrop) {
	return {
		height: `${100 / crop.height}%`,
		left: `${(-crop.x / crop.width) * 100}%`,
		top: `${(-crop.y / crop.height) * 100}%`,
		width: `${100 / crop.width}%`,
	};
}

function FixedCropArea({
	accessibleLabel,
	crop,
	imageHeight,
	imageWidth,
	onChange,
	resetLabel,
	role,
	source,
	zoomInLabel,
	zoomLabel,
	zoomOutLabel,
}: {
	readonly accessibleLabel: string;
	readonly crop: NormalizedImageCrop;
	readonly imageHeight: number;
	readonly imageWidth: number;
	readonly onChange: (crop: NormalizedImageCrop) => void;
	readonly resetLabel: string;
	readonly role: ImageAssetPresentationRole;
	readonly source: string;
	readonly zoomInLabel: string;
	readonly zoomLabel: string;
	readonly zoomOutLabel: string;
}) {
	const pointer = useRef<
		| {
				readonly id: number;
				readonly x: number;
				readonly y: number;
				readonly crop: NormalizedImageCrop;
		  }
		| undefined
	>(undefined);
	const maximumCrop = useMemo(
		() => defaultNormalizedImageCrop(role, imageWidth, imageHeight),
		[imageHeight, imageWidth, role],
	);
	const zoom = maximumCrop.width / crop.width;

	function setZoom(nextZoom: number): void {
		const boundedZoom = Math.min(5, Math.max(1, nextZoom));
		const width = maximumCrop.width / boundedZoom;
		const height = maximumCrop.height / boundedZoom;
		const centerX = crop.x + crop.width / 2;
		const centerY = crop.y + crop.height / 2;
		onChange(
			clampNormalizedImageCrop({
				x: centerX - width / 2,
				y: centerY - height / 2,
				width,
				height,
			}),
		);
	}

	function moveBy(deltaX: number, deltaY: number): void {
		onChange(
			clampNormalizedImageCrop({
				...crop,
				x: crop.x + deltaX,
				y: crop.y + deltaY,
			}),
		);
	}

	function handlePointerMove(event: PointerEvent<HTMLDivElement>): void {
		const origin = pointer.current;
		if (!origin || origin.id !== event.pointerId) return;
		const bounds = event.currentTarget.getBoundingClientRect();
		onChange(
			clampNormalizedImageCrop({
				...origin.crop,
				x: origin.crop.x - ((event.clientX - origin.x) / bounds.width) * origin.crop.width,
				y:
					origin.crop.y -
					((event.clientY - origin.y) / bounds.height) * origin.crop.height,
			}),
		);
	}

	function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
		const multiplier = event.shiftKey ? 0.1 : 0.01;
		const stepX = crop.width * multiplier;
		const stepY = crop.height * multiplier;
		switch (event.key) {
			case "ArrowLeft":
				moveBy(-stepX, 0);
				break;
			case "ArrowRight":
				moveBy(stepX, 0);
				break;
			case "ArrowUp":
				moveBy(0, -stepY);
				break;
			case "ArrowDown":
				moveBy(0, stepY);
				break;
			default:
				return;
		}
		event.preventDefault();
	}

	function handleWheel(event: WheelEvent<HTMLDivElement>): void {
		event.preventDefault();
		setZoom(zoom + (event.deltaY > 0 ? -0.1 : 0.1));
	}

	return (
		<div className="grid gap-4">
			<div
				aria-label={accessibleLabel}
				className={cn(
					"relative isolate mx-auto w-full max-w-2xl touch-none cursor-grab overflow-hidden border-2 border-dashed border-primary bg-surface-container outline-none active:cursor-grabbing focus-visible:ring-4 focus-visible:ring-ring/30",
					role === "avatar"
						? "aspect-square max-w-md"
						: role === "banner"
							? "aspect-[4/1]"
							: "aspect-[3/4] max-w-[min(42rem,43.5svh)]",
				)}
				onKeyDown={handleKeyDown}
				onPointerCancel={() => {
					pointer.current = undefined;
				}}
				onPointerDown={(event) => {
					event.currentTarget.setPointerCapture(event.pointerId);
					pointer.current = {
						id: event.pointerId,
						x: event.clientX,
						y: event.clientY,
						crop,
					};
				}}
				onPointerMove={handlePointerMove}
				onPointerUp={(event) => {
					event.currentTarget.releasePointerCapture(event.pointerId);
					pointer.current = undefined;
				}}
				onWheel={handleWheel}
				role="application"
				tabIndex={0}
			>
				<img
					alt=""
					aria-hidden
					className="pointer-events-none absolute max-w-none select-none"
					draggable={false}
					src={source}
					style={cropImageStyle(crop)}
				/>
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.55)]"
				/>
			</div>

			<div className="flex items-end gap-2">
				<Button
					aria-label={zoomOutLabel}
					disabled={zoom <= 1}
					onClick={() => setZoom(zoom - 0.25)}
					size="icon-sm"
					type="button"
					variant="outline"
				>
					<Minus aria-hidden />
				</Button>
				<Slider
					className="min-w-0 flex-1"
					max={5}
					min={1}
					onValueChange={({ value }) => {
						const nextZoom = value[0];
						if (nextZoom !== undefined) setZoom(nextZoom);
					}}
					step={0.01}
					value={[zoom]}
				>
					<SliderLabel>{zoomLabel}</SliderLabel>
				</Slider>
				<Button
					aria-label={zoomInLabel}
					disabled={zoom >= 5}
					onClick={() => setZoom(zoom + 0.25)}
					size="icon-sm"
					type="button"
					variant="outline"
				>
					<Plus aria-hidden />
				</Button>
				<Button
					onClick={() => onChange(maximumCrop)}
					size="sm"
					type="button"
					variant="quiet"
				>
					<RotateCcw aria-hidden className="size-3.5" />
					{resetLabel}
				</Button>
			</div>
		</div>
	);
}

export function ImageAssetPresentationEditor({
	assetId,
	onOpenChange,
	onSaved,
	open,
	role,
}: ImageAssetPresentationEditorProps) {
	const { t } = useTranslation(["media"]);
	const copy = t.media.presentationEditor;
	const asset = useGetApiImageAssetsById({ path: { id: assetId } }, { query: { enabled: open } });
	const update = usePutApiImageAssetsByIdPresentationsByRole();
	const [fit, setFit] = useState<"contain" | "crop">(role === "cover" ? "contain" : "crop");
	const [crop, setCrop] = useState<NormalizedImageCrop | undefined>(undefined);
	const initializedRevision = useRef<string | undefined>(undefined);

	const width = asset.data ? positiveInteger(asset.data.width) : null;
	const height = asset.data ? positiveInteger(asset.data.height) : null;
	const presentation = asset.data?.presentations.find((item) => item.role === role);
	const revisionKey = presentation ? `${assetId}:${role}:${presentation.revision}` : undefined;

	useEffect(() => {
		if (
			!open ||
			!width ||
			!height ||
			!presentation ||
			!revisionKey ||
			initializedRevision.current === revisionKey
		)
			return;
		initializedRevision.current = revisionKey;
		setFit(role === "cover" ? presentation.fit : "crop");
		setCrop(presentation.crop ?? defaultNormalizedImageCrop(role, width, height));
	}, [height, open, presentation, revisionKey, role, width]);

	async function save(): Promise<void> {
		if (!crop) return;
		try {
			const updated = await update.mutateAsync({
				path: { id: assetId, role },
				body: fit === "contain" ? { fit: "contain" } : { fit: "crop", crop },
			});
			onSaved({ id: assetId, url: updated.contentUrl });
			onOpenChange(false);
		} catch {
			// The typed mutation state supplies the localized visible failure below.
		}
	}

	const ready = Boolean(asset.data && width && height && presentation && crop);
	return (
		<Dialog onOpenChange={({ open: nextOpen }) => onOpenChange(nextOpen)} open={open}>
			<DialogContent showCloseButton={false} size="2xl">
				<DialogHeader className="flex-row items-start justify-between gap-4">
					<div className="grid gap-2">
						<DialogTitle>{copy.title[role]}</DialogTitle>
						<DialogDescription>{copy.description[role]}</DialogDescription>
					</div>
					<DialogClose asChild>
						<Button
							aria-label={copy.close}
							size="icon-sm"
							type="button"
							variant="quiet"
						>
							<X aria-hidden />
						</Button>
					</DialogClose>
				</DialogHeader>
				<DialogBody className="grid gap-5">
					{asset.isPending ? (
						<p className="flex items-center gap-2 text-muted-foreground text-sm">
							<Spinner aria-hidden />
							{copy.loading}
						</p>
					) : !ready ? (
						<p className="text-destructive text-sm">{copy.loadFailed}</p>
					) : (
						<>
							{role === "cover" ? (
								<Field>
									<FieldLabel>{copy.coverMode.label}</FieldLabel>
									<NativeSelect
										onChange={(event) => {
											const nextFit = event.currentTarget.value;
											if (nextFit === "contain" || nextFit === "crop")
												setFit(nextFit);
										}}
										value={fit}
									>
										<NativeSelectOption value="contain">
											{copy.coverMode.contain}
										</NativeSelectOption>
										<NativeSelectOption value="crop">
											{copy.coverMode.crop}
										</NativeSelectOption>
									</NativeSelect>
									<p className="text-muted-foreground text-xs">
										{fit === "contain"
											? copy.coverMode.containDescription
											: copy.coverMode.cropDescription}
									</p>
								</Field>
							) : null}
							{fit === "crop" && crop && width && height ? (
								<FixedCropArea
									accessibleLabel={copy.cropArea}
									crop={crop}
									imageHeight={height}
									imageWidth={width}
									onChange={setCrop}
									resetLabel={copy.reset}
									role={role}
									source={asset.data?.contentUrl ?? ""}
									zoomInLabel={copy.zoomIn}
									zoomLabel={copy.zoom}
									zoomOutLabel={copy.zoomOut}
								/>
							) : asset.data ? (
								<Cover
									alt={copy.coverPreview}
									className="mx-auto max-h-[58svh] w-auto"
									src={asset.data.contentUrl}
								/>
							) : null}
							{role === "avatar" && crop ? (
								<div className="grid justify-items-center gap-2">
									<p className="font-medium text-sm">{copy.avatarPreview}</p>
									<div className="relative size-28 overflow-hidden rounded-full bg-surface-container">
										<img
											alt=""
											className="absolute max-w-none"
											src={asset.data?.contentUrl}
											style={cropImageStyle(crop)}
										/>
									</div>
								</div>
							) : null}
							{role === "banner" && crop ? (
								<div className="grid gap-2">
									<p className="font-medium text-sm">{copy.bannerPreview}</p>
									<div className="relative aspect-[4/1] overflow-hidden bg-surface-container">
										<img
											alt=""
											className="absolute max-w-none"
											src={asset.data?.contentUrl}
											style={cropImageStyle(crop)}
										/>
									</div>
								</div>
							) : null}
						</>
					)}
					{update.isError ? (
						<p className="text-destructive text-sm">{copy.saveFailed}</p>
					) : null}
				</DialogBody>
				<DialogFooter>
					<DialogClose asChild>
						<Button type="button" variant="quiet">
							{copy.cancel}
						</Button>
					</DialogClose>
					<Button
						disabled={!ready}
						isLoading={update.isPending}
						onClick={() => void save()}
						type="button"
						variant="solid"
					>
						{copy.save}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
