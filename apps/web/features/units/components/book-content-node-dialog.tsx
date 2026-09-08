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
import type { WorkOwnershipMode } from "./work-ownership-field";
import type { BookDraftNode } from "../model/book-content-structure-draft";
import {
	BookContentStructureDestinationDialog,
	type BookStructureDestination,
} from "./book-content-structure-destination-dialog";

export type BookContentNodeDialogRequest = {
	readonly kind: "text_version" | "chapter" | "label";
	readonly destination: BookStructureDestination;
};

export type BookContentNodeDialogSubmission =
	| {
			readonly mode: "create";
			readonly title: string;
			readonly destination: BookStructureDestination;
			readonly ownershipMode?: WorkOwnershipMode;
	  }
	| {
			readonly mode: "attach";
			readonly unit: EntityPickerValue;
			readonly destination: BookStructureDestination;
	  };

type DialogInput = {
	readonly mode: "create" | "attach";
	readonly create: {
		readonly title: string;
		readonly ownershipMode: WorkOwnershipMode;
	};
	readonly attach: { readonly unit?: EntityPickerValue };
};

function isChapterOwnershipSelection(
	value: string,
): value is DialogInput["create"]["ownershipMode"] {
	return value === "profile_owned" || value === "community_owned";
}

function isDialogMode(value: string): value is DialogInput["mode"] {
	return value === "create" || value === "attach";
}

function destinationLabel(
	nodes: readonly BookDraftNode[],
	destination: BookStructureDestination,
	rootLabel: string,
): string {
	if (destination.kind === "root") return rootLabel;
	return nodes.find(({ id }) => id === destination.nodeId)?.title ?? rootLabel;
}

export function BookContentNodeDialog({
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
	readonly nodes: readonly BookDraftNode[];
	readonly ownerUnitId: string;
	readonly onClose: () => void;
	readonly onSubmit: (submission: BookContentNodeDialogSubmission) => void;
	readonly pending: boolean;
	readonly request: BookContentNodeDialogRequest;
	readonly unsavedChanges: boolean;
}) {
	const { t } = useTranslation(["engagement", "units", "ui"]);
	const formId = useId();
	const [input, setInput] = useState<DialogInput>({
		mode: request.kind === "text_version" ? "attach" : "create",
		create: { title: "", ownershipMode: "profile_owned" },
		attach: {},
	});
	const [destination, setDestination] = useState<BookStructureDestination>(request.destination);
	const [destinationDialogOpen, setDestinationDialogOpen] = useState(false);
	const excludedUnitIds = useMemo(() => new Set([ownerUnitId]), [ownerUnitId]);
	const contentKind = request.kind;
	const title =
		contentKind === "text_version"
			? t.units.content.addBook
			: contentKind === "chapter"
				? t.units.content.addChapter
				: t.units.content.addLabel;
	const description =
		contentKind === "text_version"
			? t.units.content.addBookDescription
			: contentKind === "chapter"
				? t.units.content.addChapterDescription
				: t.units.content.addLabelDescription;
	const submitLabel =
		input.mode === "create"
			? contentKind === "chapter"
				? t.units.content.createChapterAndSave
				: t.units.content.createLabelAndSave
			: contentKind === "text_version"
				? t.units.content.attachBookAndSave
				: contentKind === "chapter"
					? t.units.content.attachChapterAndSave
					: t.units.content.attachLabelAndSave;
	const canSubmit =
		input.mode === "create"
			? contentKind !== "text_version" && Boolean(input.create.title.trim())
			: Boolean(input.attach.unit);

	return (
		<>
			<Dialog
				onOpenChange={({ open }) => {
					if (!open && !pending) onClose();
				}}
				open
			>
				<DialogContent size="lg">
					<DialogHeader description={description} title={title} />
					<DialogBody>
						<form
							className="grid gap-5"
							id={formId}
							onSubmit={(event) => {
								event.preventDefault();
								if (pending) return;
								if (input.mode === "create" && contentKind !== "text_version") {
									const normalizedTitle = input.create.title.trim();
									if (normalizedTitle)
										onSubmit({
											mode: "create",
											title: normalizedTitle,
											destination,
											ownershipMode: input.create.ownershipMode,
										});
									return;
								}
								if (input.attach.unit)
									onSubmit({
										mode: "attach",
										unit: input.attach.unit,
										destination,
									});
							}}
						>
							<Tabs
								onValueChange={({ value }) => {
									if (!isDialogMode(value) || value === input.mode) return;
									setInput((current) => ({ ...current, mode: value }));
								}}
								value={input.mode}
							>
								<TabsList aria-label={t.units.content.addMode} className="w-full">
									<TabsTrigger disabled={pending || contentKind === "text_version"} value="create">
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
											onChange={(event) => {
												const title = event.currentTarget.value;
												setInput((current) => ({
													...current,
													create: { ...current.create, title },
												}));
											}}
											required
											value={input.create.title}
										/>
									</Field>
									{contentKind === "chapter" ? (
										<Field>
											<FieldLabel>{t.units.content.chapterOwnership}</FieldLabel>
											<NativeSelect
												name="chapterOwnership"
												onChange={(event) => {
													const nextValue = event.currentTarget.value;
													if (!isChapterOwnershipSelection(nextValue)) return;
													setInput((current) => ({
														...current,
														create: {
															...current.create,
															ownershipMode: nextValue,
														},
													}));
												}}
												value={input.create.ownershipMode}
											>
												<NativeSelectOption value="profile_owned">
													{t.units.content.profileOwnedChapter}
												</NativeSelectOption>
												<NativeSelectOption value="community_owned">
													{t.units.content.communityOwnedChapter}
												</NativeSelectOption>
											</NativeSelect>
										</Field>
									) : null}
								</TabsContent>
								<TabsContent className="pt-3" value="attach">
									<Field required>
										<FieldLabel>
											{contentKind === "text_version"
												? t.units.content.existingBook
												: contentKind === "chapter"
													? t.units.content.existingChapter
													: t.units.content.existingLabel}
										</FieldLabel>
										<fieldset className="contents" disabled={pending}>
											<EntityPicker
												ariaLabel={
													contentKind === "text_version"
														? t.units.content.searchExistingBook
														: contentKind === "chapter"
															? t.units.content.searchExistingChapter
															: t.units.content.searchExistingLabel
												}
												excludedIds={excludedUnitIds}
												index="units"
												owners={
													contentKind === "text_version"
														? ["publishing"]
														: contentKind === "chapter"
															? ["post"]
															: ["label"]
												}
												shapes={
													contentKind === "text_version"
														? ["text_version"]
														: contentKind === "chapter"
															? ["chapter"]
															: undefined
												}
												onChange={(unit) =>
													setInput((current) => ({
														...current,
														attach: { unit },
													}))
												}
												onClear={() =>
													setInput((current) => ({
														...current,
														attach: {},
													}))
												}
												placeholder={
													contentKind === "chapter"
														? t.ui.pickerPlaceholders.post
														: t.ui.pickerPlaceholders.unit
												}
												value={input.attach.unit}
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
								<p className="text-muted-foreground text-sm">
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
							{submitLabel}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			{destinationDialogOpen ? (
				<BookContentStructureDestinationDialog
					description={t.units.content.choosePositionDescription}
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
