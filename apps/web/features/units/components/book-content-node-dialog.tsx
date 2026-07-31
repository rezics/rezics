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
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@rezics/ui";
import { ChevronRight, Folder } from "lucide-react";
import { useId, useState } from "react";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import type { BookDraftNode } from "../model/book-content-structure-draft";
import {
	BookContentStructureDestinationDialog,
	type BookStructureDestination,
} from "./book-content-structure-destination-dialog";

export type BookContentNodeDialogRequest = {
	readonly kind: "chapter" | "label";
	readonly destination: BookStructureDestination;
};

export type BookContentNodeDialogSubmission =
	| {
			readonly mode: "create";
			readonly title: string;
			readonly destination: BookStructureDestination;
	  }
	| {
			readonly mode: "attach";
			readonly unit: EntityPickerValue;
			readonly destination: BookStructureDestination;
	  };

type DialogInput = {
	readonly mode: "create" | "attach";
	readonly create: { readonly title: string };
	readonly attach: { readonly unit?: EntityPickerValue };
};

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
	onClose,
	onSubmit,
	pending,
	request,
	unsavedChanges,
}: {
	readonly error: unknown;
	readonly nodes: readonly BookDraftNode[];
	readonly onClose: () => void;
	readonly onSubmit: (submission: BookContentNodeDialogSubmission) => void;
	readonly pending: boolean;
	readonly request: BookContentNodeDialogRequest;
	readonly unsavedChanges: boolean;
}) {
	const { t } = useTranslation(["engagement", "units", "ui"]);
	const formId = useId();
	const [input, setInput] = useState<DialogInput>({
		mode: "create",
		create: { title: "" },
		attach: {},
	});
	const [destination, setDestination] = useState<BookStructureDestination>(request.destination);
	const [destinationDialogOpen, setDestinationDialogOpen] = useState(false);
	const contentKind = request.kind;
	const title = contentKind === "chapter" ? t.units.content.addChapter : t.units.content.addLabel;
	const description =
		contentKind === "chapter"
			? t.units.content.addChapterDescription
			: t.units.content.addLabelDescription;
	const submitLabel =
		input.mode === "create"
			? contentKind === "chapter"
				? t.units.content.createChapterAndSave
				: t.units.content.createLabelAndSave
			: contentKind === "chapter"
				? t.units.content.attachChapterAndSave
				: t.units.content.attachLabelAndSave;
	const canSubmit =
		input.mode === "create" ? Boolean(input.create.title.trim()) : Boolean(input.attach.unit);

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
								if (input.mode === "create") {
									const normalizedTitle = input.create.title.trim();
									if (normalizedTitle)
										onSubmit({
											mode: "create",
											title: normalizedTitle,
											destination,
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
									<TabsTrigger disabled={pending} value="create">
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
											onChange={(event) =>
												setInput((current) => ({
													...current,
													create: { title: event.currentTarget.value },
												}))
											}
											required
											value={input.create.title}
										/>
									</Field>
								</TabsContent>
								<TabsContent className="pt-3" value="attach">
									<Field required>
										<FieldLabel>
											{contentKind === "chapter"
												? t.units.content.existingChapter
												: t.units.content.existingLabel}
										</FieldLabel>
										<fieldset className="contents" disabled={pending}>
											<EntityPicker
												ariaLabel={
													contentKind === "chapter"
														? t.units.content.searchExistingChapter
														: t.units.content.searchExistingLabel
												}
												index={
													contentKind === "chapter" ? "posts" : "units"
												}
												kind={contentKind}
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
									<Folder
										aria-hidden
										className="size-4 shrink-0 text-muted-foreground"
									/>
									<span className="min-w-0 flex-1 truncate font-medium">
										{destinationLabel(nodes, destination, t.units.content.root)}
									</span>
									<ChevronRight
										aria-hidden
										className="size-4 shrink-0 text-muted-foreground"
									/>
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
