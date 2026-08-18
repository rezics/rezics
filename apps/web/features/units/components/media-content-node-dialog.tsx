"use client";

import {
	Button,
	Dialog,
	DialogBody,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	EntityPicker,
	type EntityPickerValue,
	Field,
	FieldLabel,
	Input,
	NativeSelect,
	NativeSelectOption,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@rezics/ui";
import { ChevronRight, Folder } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import type { MediaDraftNode } from "../model/media-content-structure-draft";
import {
	ContentStructureDestinationDialog,
	type ContentStructureDestination,
} from "./book-content-structure-destination-dialog";

export type MediaContentNodeKind = "media" | "video" | "audio" | "label";
type CreatableMediaContentNodeKind = Exclude<MediaContentNodeKind, "media">;

export type MediaContentNodeDialogRequest = {
	readonly kind: MediaContentNodeKind;
	readonly destination: ContentStructureDestination;
};

export type MediaContentNodeDialogSubmission =
	| {
			readonly mode: "create";
			readonly title: string;
			readonly contentKind: CreatableMediaContentNodeKind;
			readonly destination: ContentStructureDestination;
	  }
	| {
			readonly mode: "attach";
			readonly unit: EntityPickerValue & { readonly kind: MediaContentNodeKind };
			readonly destination: ContentStructureDestination;
	  };

type DialogMode = "create" | "attach";
type TimedMediaKindFilter = "all" | "video" | "audio";

function isDialogMode(value: string): value is DialogMode {
	return value === "create" || value === "attach";
}

function isTimedMediaKindFilter(value: string): value is TimedMediaKindFilter {
	return value === "all" || value === "video" || value === "audio";
}

function isMediaContentNodeKind(value: string | undefined): value is MediaContentNodeKind {
	return value === "media" || value === "video" || value === "audio" || value === "label";
}

function destinationLabel(
	nodes: readonly MediaDraftNode[],
	destination: ContentStructureDestination,
	rootLabel: string,
): string {
	if (destination.kind === "root") return rootLabel;
	return nodes.find(({ id }) => id === destination.nodeId)?.title ?? rootLabel;
}

export function MediaContentNodeDialog({
	error,
	nodes,
	ownerUnitId,
	onClose,
	onSubmit,
	pending,
	request,
	unsavedChanges,
}: {
	readonly error: unknown;
	readonly nodes: readonly MediaDraftNode[];
	readonly ownerUnitId: string;
	readonly onClose: () => void;
	readonly onSubmit: (submission: MediaContentNodeDialogSubmission) => void;
	readonly pending: boolean;
	readonly request: MediaContentNodeDialogRequest;
	readonly unsavedChanges: boolean;
}) {
	const { t } = useTranslation(["engagement", "units", "ui"]);
	const formId = useId();
	const [mode, setMode] = useState<DialogMode>(request.kind === "media" ? "attach" : "create");
	const [title, setTitle] = useState("");
	const [unit, setUnit] = useState<EntityPickerValue>();
	const [mediaKindFilter, setMediaKindFilter] = useState<TimedMediaKindFilter>("all");
	const [destination, setDestination] = useState<ContentStructureDestination>(request.destination);
	const [destinationDialogOpen, setDestinationDialogOpen] = useState(false);
	const excludedUnitIds = useMemo(() => new Set([ownerUnitId]), [ownerUnitId]);
	const label = request.kind === "label";
	const media = request.kind === "media";
	const dialogTitle = media
		? t.units.content.addMedia
		: request.kind === "video"
			? t.units.content.addVideo
			: request.kind === "audio"
				? t.units.content.addAudio
				: t.units.content.addLabel;
	const description = media
		? t.units.content.addMediaDescription
		: request.kind === "video"
			? t.units.content.addVideoDescription
			: request.kind === "audio"
				? t.units.content.addAudioDescription
				: t.units.content.addLabelDescription;
	const attachKind = media
		? unit?.kind === "media"
			? "media"
			: undefined
		: label
			? unit?.kind === "label"
				? "label"
				: undefined
			: isMediaContentNodeKind(unit?.kind) && unit.kind !== "label" && unit.kind !== "media"
				? unit.kind
				: undefined;
	const canSubmit =
		mode === "create" ? !media && Boolean(title.trim()) : Boolean(unit && attachKind);

	return (
		<>
			<Dialog
				onOpenChange={({ open }) => {
					if (!open && !pending) onClose();
				}}
				open
			>
				<DialogContent size="lg">
					<DialogHeader description={description} title={dialogTitle} />
					<DialogBody>
						<form
							className="grid gap-5"
							id={formId}
							onSubmit={(event) => {
								event.preventDefault();
								if (pending) return;
								if (mode === "create" && request.kind !== "media") {
									const normalizedTitle = title.trim();
									if (normalizedTitle)
										onSubmit({
											mode: "create",
											title: normalizedTitle,
											contentKind: request.kind,
											destination,
										});
									return;
								}
								if (unit && attachKind)
									onSubmit({
										mode: "attach",
										unit: { ...unit, kind: attachKind },
										destination,
									});
							}}
						>
							<Tabs
								onValueChange={({ value }) => {
									if (isDialogMode(value)) setMode(value);
								}}
								value={mode}
							>
								<TabsList aria-label={t.units.content.addMode} className="w-full">
									<TabsTrigger disabled={pending || media} value="create">
										{t.units.content.createMode}
									</TabsTrigger>
									<TabsTrigger disabled={pending} value="attach">
										{t.units.content.attachMode}
									</TabsTrigger>
								</TabsList>
								<TabsContent className="pt-3" value="create">
									<Field required>
										<FieldLabel>{t.ui.title}</FieldLabel>
										<Input
											autoFocus
											disabled={pending}
											maxLength={500}
											onChange={(event) => setTitle(event.currentTarget.value)}
											required
											value={title}
										/>
									</Field>
								</TabsContent>
								<TabsContent className="grid gap-4 pt-3" value="attach">
									{label || media ? null : (
										<Field>
											<FieldLabel>{t.units.content.mediaKindFilter}</FieldLabel>
											<NativeSelect
												disabled={pending}
												onChange={(event) => {
													if (isTimedMediaKindFilter(event.currentTarget.value)) {
														setMediaKindFilter(event.currentTarget.value);
														setUnit(undefined);
													}
												}}
												value={mediaKindFilter}
											>
												<NativeSelectOption value="all">
													{t.units.content.allMediaKinds}
												</NativeSelectOption>
												<NativeSelectOption value="video">{t.units.types.video}</NativeSelectOption>
												<NativeSelectOption value="audio">{t.units.types.audio}</NativeSelectOption>
											</NativeSelect>
										</Field>
									)}
									<Field required>
										<FieldLabel>
											{media
												? t.units.content.existingMedia
												: label
													? t.units.content.existingLabel
													: t.units.content.existingMediaItem}
										</FieldLabel>
										<fieldset className="contents" disabled={pending}>
											<EntityPicker
												ariaLabel={
													media
														? t.units.content.searchExistingMedia
														: label
															? t.units.content.searchExistingLabel
															: t.units.content.searchExistingMediaItem
												}
												excludedIds={excludedUnitIds}
												index="units"
												{...(media
													? { kind: "media" }
													: label
														? { kind: "label" }
														: {
																kinds:
																	mediaKindFilter === "all"
																		? ["video", "audio"]
																		: [mediaKindFilter],
															})}
												onChange={setUnit}
												onClear={() => setUnit(undefined)}
												placeholder={t.ui.pickerPlaceholders.unit}
												value={unit}
											/>
										</fieldset>
									</Field>
								</TabsContent>
							</Tabs>
							<Field>
								<FieldLabel>{t.units.content.structure}</FieldLabel>
								<button
									aria-haspopup="dialog"
									className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-border-weak bg-muted/35 px-3.5 text-start text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-64"
									disabled={pending}
									onClick={() => setDestinationDialogOpen(true)}
									type="button"
								>
									<Folder aria-hidden className="size-4 shrink-0 text-muted-foreground" />
									<span className="min-w-0 flex-1 truncate font-medium">
										{destinationLabel(nodes, destination, t.units.content.root)}
									</span>
									<ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
								</button>
							</Field>
							{unsavedChanges ? (
								<p className="text-sm text-muted-foreground">
									{t.units.content.saveCurrentChangesNotice}
								</p>
							) : null}
							<RequestFailure error={error} />
						</form>
					</DialogBody>
					<DialogFooter>
						<DialogClose asChild>
							<Button disabled={pending} type="button" variant="quiet">
								{t.engagement.cancel}
							</Button>
						</DialogClose>
						<Button
							disabled={!canSubmit || pending}
							form={formId}
							isLoading={pending}
							type="submit"
							variant="solid"
						>
							{mode === "create"
								? label
									? t.units.content.createLabelAndSave
									: t.units.content.createMediaItemAndSave
								: media
									? t.units.content.attachMediaAndSave
									: label
										? t.units.content.attachLabelAndSave
										: t.units.content.attachMediaItemAndSave}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			{destinationDialogOpen ? (
				<ContentStructureDestinationDialog
					description={t.units.content.mediaChoosePositionDescription}
					nodes={nodes}
					onClose={() => setDestinationDialogOpen(false)}
					onSelect={(nextDestination) => {
						setDestination(nextDestination);
						setDestinationDialogOpen(false);
					}}
					selectedDestination={destination}
					title={t.units.content.choosePosition}
				/>
			) : null}
		</>
	);
}
