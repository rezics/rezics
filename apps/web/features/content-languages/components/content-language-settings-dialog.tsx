"use client";

import {
	closestCenter,
	DndContext,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
} from "@dnd-kit/core";
import {
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ContentLanguageValues, isContentLanguage, type ContentLanguage } from "@rezics/i18n";
import {
	useDeleteApiUnitsByIdByUnitIdLocalizationsByLanguage,
	usePutApiUnitsByIdByUnitIdLocalizationOrder,
} from "@rezics/openapi-tanstack-query";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	NativeSelect,
	NativeSelectOption,
} from "@rezics/ui";
import {
	ArrowDown,
	ArrowUp,
	ChevronDown,
	ChevronUp,
	GripVertical,
	Plus,
	Trash2,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@rezics/ui";
import { RequestFailure } from "@/i18n/request-failure";
import { useTranslation } from "@/i18n/client";
import { useContentLanguageEditor } from "../hooks/use-content-language-editor";
import {
	contentLanguageOrdersEqual,
	moveContentLanguage,
	type ContentLanguageOrder,
} from "../model/content-language-order";

function contentLanguageFromDragId(value: string | number): ContentLanguage | undefined {
	const language = String(value);
	return isContentLanguage(language) ? language : undefined;
}

export function ContentLanguageSettingsDialog({
	open,
	onOpenChange,
}: {
	readonly open: boolean;
	readonly onOpenChange: (open: boolean) => void;
}) {
	const { t } = useTranslation(["errors", "locale", "units"]);
	const {
		unitId,
		languages,
		selectedLanguage,
		requestLanguage,
		replaceLanguage,
		languagesChanged,
	} = useContentLanguageEditor();
	const [draft, setDraft] = useState<ContentLanguageOrder>(languages);
	const [adding, setAdding] = useState(false);
	const missingLanguages = ContentLanguageValues.filter(
		(language) => !languages.includes(language),
	);
	const [languageToAdd, setLanguageToAdd] = useState<ContentLanguage | undefined>(
		missingLanguages[0],
	);
	const [languageToRemove, setLanguageToRemove] = useState<ContentLanguage>();
	const reorder = usePutApiUnitsByIdByUnitIdLocalizationOrder();
	const remove = useDeleteApiUnitsByIdByUnitIdLocalizationsByLanguage();
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

	function handleDragEnd(event: DragEndEvent) {
		const active = contentLanguageFromDragId(event.active.id);
		const over = event.over ? contentLanguageFromDragId(event.over.id) : undefined;
		if (!active || !over || active === over) return;
		const targetIndex = draft.indexOf(over);
		if (targetIndex < 0) return;
		setDraft(moveContentLanguage(draft, active, targetIndex));
	}

	async function saveOrder() {
		try {
			await reorder.mutateAsync({
				path: { unitId },
				body: { expectedLanguages: [...languages], languages: [...draft] },
			});
			await languagesChanged();
			onOpenChange(false);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	async function confirmRemove() {
		if (!languageToRemove) return;
		try {
			const result = await remove.mutateAsync({
				path: { unitId, language: languageToRemove },
				body: { expectedLanguages: [...languages] },
			});
			if (selectedLanguage === languageToRemove) {
				const [nextLanguage] = result.languages;
				if (nextLanguage) replaceLanguage(nextLanguage);
			}
			await languagesChanged();
			onOpenChange(false);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<Dialog open={open} onOpenChange={(details) => onOpenChange(details.open)}>
			<DialogContent size="lg">
				<DialogHeader
					description={t.units.contentLanguages.dialogDescription}
					title={t.units.contentLanguages.dialogTitle}
				>
					<div className="mt-2 flex justify-end">
						<Button
							disabled={!missingLanguages.length}
							onClick={() => setAdding((value) => !value)}
							size="sm"
							type="button"
							variant="outline"
						>
							<Plus aria-hidden />
							{t.units.contentLanguages.add}
						</Button>
					</div>
				</DialogHeader>
				<DialogBody className="grid gap-4">
					{adding ? (
						missingLanguages.length ? (
							<div className="grid gap-3 rounded-xl border bg-muted/24 p-4">
								<p className="text-sm text-muted-foreground">
									{t.units.contentLanguages.addDescription}
								</p>
								<div className="flex flex-wrap gap-2">
									<NativeSelect
										aria-label={t.units.contentLanguages.controlLabel}
										onChange={(event) => {
											const language = event.currentTarget.value;
											if (isContentLanguage(language)) setLanguageToAdd(language);
										}}
										value={languageToAdd}
									>
										{missingLanguages.map((language) => (
											<NativeSelectOption key={language} value={language}>
												{t.locale.contentLanguages[language]}
											</NativeSelectOption>
										))}
									</NativeSelect>
									<Button
										disabled={!languageToAdd}
										onClick={() => {
											if (languageToAdd && requestLanguage(languageToAdd)) onOpenChange(false);
										}}
										size="sm"
										type="button"
									>
										{t.units.contentLanguages.add}
									</Button>
								</div>
							</div>
						) : (
							<p className="text-sm text-muted-foreground">
								{t.units.contentLanguages.noMoreLanguages}
							</p>
						)
					) : null}
					<DndContext
						accessibility={{
							screenReaderInstructions: {
								draggable: t.units.contentLanguages.instructions,
							},
							announcements: {
								onDragStart({ active }) {
									const language = contentLanguageFromDragId(active.id);
									return language ? t.locale.contentLanguages[language] : undefined;
								},
								onDragOver({ over }) {
									if (!over) return;
									const language = contentLanguageFromDragId(over.id);
									return language ? t.locale.contentLanguages[language] : undefined;
								},
								onDragEnd({ active, over }) {
									if (!over) return;
									const language = contentLanguageFromDragId(active.id);
									const target = contentLanguageFromDragId(over.id);
									if (!language || !target) return;
									const position = draft.indexOf(target) + 1;
									return t.units.contentLanguages.moved({
										language: t.locale.contentLanguages[language],
										position,
										count: draft.length,
									});
								},
								onDragCancel() {
									return t.units.contentLanguages.cancel;
								},
							},
						}}
						collisionDetection={closestCenter}
						onDragEnd={handleDragEnd}
						sensors={sensors}
					>
						<SortableContext items={[...draft]} strategy={verticalListSortingStrategy}>
							<ul className="grid gap-2">
								{draft.map((language, index) => (
									<SortableLanguage
										confirmingRemoval={languageToRemove === language}
										index={index}
										key={language}
										language={language}
										onCancelRemove={() => setLanguageToRemove(undefined)}
										onConfirmRemove={() => void confirmRemove()}
										onMove={(targetIndex) =>
											setDraft(moveContentLanguage(draft, language, targetIndex))
										}
										onRemove={() => setLanguageToRemove(language)}
										order={draft}
										removing={remove.isPending}
									/>
								))}
							</ul>
						</SortableContext>
					</DndContext>
					<RequestFailure error={reorder.error ?? remove.error} fallback={t.errors.unknown} />
				</DialogBody>
				<DialogFooter>
					<Button onClick={() => onOpenChange(false)} type="button" variant="quiet">
						{t.units.contentLanguages.cancel}
					</Button>
					<Button
						disabled={contentLanguageOrdersEqual(languages, draft)}
						isLoading={reorder.isPending}
						onClick={() => void saveOrder()}
						type="button"
					>
						{t.units.contentLanguages.saveOrder}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function SortableLanguage({
	language,
	order,
	index,
	confirmingRemoval,
	removing,
	onMove,
	onRemove,
	onCancelRemove,
	onConfirmRemove,
}: {
	readonly language: ContentLanguage;
	readonly order: ContentLanguageOrder;
	readonly index: number;
	readonly confirmingRemoval: boolean;
	readonly removing: boolean;
	readonly onMove: (targetIndex: number) => void;
	readonly onRemove: () => void;
	readonly onCancelRemove: () => void;
	readonly onConfirmRemove: () => void;
}) {
	const { t } = useTranslation(["locale", "units"]);
	const sortable = useSortable({ id: language });
	const style = {
		transform: CSS.Transform.toString(sortable.transform),
		transition: sortable.transition,
	};
	return (
		<li
			ref={sortable.setNodeRef}
			style={style}
			className="rounded-xl border bg-background p-3 shadow-xs"
		>
			<div className="flex items-center gap-2">
				<Button
					aria-label={`${t.units.contentLanguages.drag}: ${t.locale.contentLanguages[language]}`}
					ref={sortable.setActivatorNodeRef}
					size="icon-sm"
					type="button"
					variant="quiet"
					{...sortable.attributes}
					{...sortable.listeners}
				>
					<GripVertical aria-hidden />
				</Button>
				<span className="min-w-0 flex-1 font-medium">{t.locale.contentLanguages[language]}</span>
				<div className="flex items-center gap-1">
					<Button
						aria-label={t.units.contentLanguages.moveFirst}
						disabled={index === 0}
						onClick={() => onMove(0)}
						size="icon-sm"
						type="button"
						variant="quiet"
					>
						<ChevronUp aria-hidden />
					</Button>
					<Button
						aria-label={t.units.contentLanguages.moveUp}
						disabled={index === 0}
						onClick={() => onMove(index - 1)}
						size="icon-sm"
						type="button"
						variant="quiet"
					>
						<ArrowUp aria-hidden />
					</Button>
					<Button
						aria-label={t.units.contentLanguages.moveDown}
						disabled={index === order.length - 1}
						onClick={() => onMove(index + 1)}
						size="icon-sm"
						type="button"
						variant="quiet"
					>
						<ArrowDown aria-hidden />
					</Button>
					<Button
						aria-label={t.units.contentLanguages.moveLast}
						disabled={index === order.length - 1}
						onClick={() => onMove(order.length - 1)}
						size="icon-sm"
						type="button"
						variant="quiet"
					>
						<ChevronDown aria-hidden />
					</Button>
					<Button
						aria-label={t.units.contentLanguages.remove}
						disabled={order.length === 1}
						onClick={onRemove}
						size="icon-sm"
						type="button"
						variant="quiet"
					>
						<Trash2 aria-hidden />
					</Button>
				</div>
			</div>
			{confirmingRemoval ? (
				<div className="mt-3 grid gap-3 border-t pt-3">
					<p className="text-sm text-destructive">
						{t.units.contentLanguages.removeConfirm({
							language: t.locale.contentLanguages[language],
						})}
					</p>
					<div className="flex justify-end gap-2">
						<Button onClick={onCancelRemove} size="sm" type="button" variant="quiet">
							{t.units.contentLanguages.cancel}
						</Button>
						<Button
							isLoading={removing}
							onClick={onConfirmRemove}
							size="sm"
							type="button"
							variant="destructive"
						>
							{t.units.contentLanguages.remove}
						</Button>
					</div>
				</div>
			) : null}
		</li>
	);
}
