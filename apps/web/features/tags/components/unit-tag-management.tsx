"use client";

import { Button, Card, CardContent, EntityPicker } from "@rezics/ui";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useState } from "react";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";

interface PickedEntity {
	readonly id: string;
	readonly label: string;
}

export function UnitTagManagement({
	addError,
	addPending,
	addStructureError,
	addStructurePending,
	canVote,
	contextKind,
	hasDevelopmentPreviewAccess,
	onAddStructure,
	onAddTag,
}: {
	readonly addError: unknown;
	readonly addPending: boolean;
	readonly addStructureError: unknown;
	readonly addStructurePending: boolean;
	readonly canVote: boolean;
	readonly contextKind: "global" | "realm";
	readonly hasDevelopmentPreviewAccess: boolean;
	readonly onAddStructure: (structureId: string) => Promise<void>;
	readonly onAddTag: (tagId: string) => Promise<void>;
}) {
	const { t } = useTranslation(["tags", "ui"]);
	const [selectedTag, setSelectedTag] = useState<PickedEntity>();
	const [selectedStructure, setSelectedStructure] = useState<PickedEntity>();
	if (!canVote) return null;
	const showStructureManagement = contextKind === "global" && hasDevelopmentPreviewAccess;
	const addCopy = contextKind === "global" ? t.tags.global : t.tags.realms;
	return (
		<Card>
			<CardContent className="grid gap-6 p-4 sm:p-5">
				{showStructureManagement ? (
					<div className="grid gap-3">
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div className="grid gap-1">
								<h2 className="font-semibold">{t.tags.structures.addTitle}</h2>
								<p className="text-sm text-muted-foreground">
									{t.tags.structures.addDescription}
								</p>
							</div>
							<Button asChild variant="outline">
								<Link href="/tag-structures/new">{t.tags.structures.create}</Link>
							</Button>
						</div>
						<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
							<EntityPicker
								index="tag-structures"
								onChange={setSelectedStructure}
								value={selectedStructure}
							/>
							<Button
								disabled={!selectedStructure}
								isLoading={addStructurePending}
								onClick={() => {
									if (!selectedStructure) return;
									void onAddStructure(selectedStructure.id)
										.then(() => setSelectedStructure(undefined))
										.catch(() => undefined);
								}}
							>
								{t.tags.structures.add}
							</Button>
						</div>
						<RequestFailure error={addStructureError} fallback={t.ui.retryLater} />
					</div>
				) : null}
				<div
					className={
						showStructureManagement
							? "grid gap-3 border-t border-border-weak pt-6"
							: "grid gap-3"
					}
				>
					<div className="grid gap-1">
						<h2 className="font-semibold">{addCopy.addTitle}</h2>
						<p className="text-sm text-muted-foreground">{addCopy.addDescription}</p>
					</div>
					<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
						<EntityPicker index="tags" onChange={setSelectedTag} value={selectedTag} />
						<Button
							disabled={!selectedTag}
							isLoading={addPending}
							onClick={() => {
								if (!selectedTag) return;
								void onAddTag(selectedTag.id)
									.then(() => setSelectedTag(undefined))
									.catch(() => undefined);
							}}
						>
							{addCopy.add}
						</Button>
					</div>
					<RequestFailure error={addError} fallback={t.ui.retryLater} />
				</div>
			</CardContent>
		</Card>
	);
}
