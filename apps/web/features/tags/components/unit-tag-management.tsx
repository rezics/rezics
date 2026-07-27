"use client";

import { Button, Card, CardContent, EntityPicker } from "@rezics/ui";
import Link from "next/link";
import { useState } from "react";

import { SignInButton } from "@/features/auth/auth-portal";
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
	hasDevelopmentPreviewAccess,
	signedIn,
	onAddStructure,
	onAddTag,
}: {
	readonly addError: unknown;
	readonly addPending: boolean;
	readonly addStructureError: unknown;
	readonly addStructurePending: boolean;
	readonly hasDevelopmentPreviewAccess: boolean;
	readonly signedIn: boolean;
	readonly onAddStructure: (structureId: string) => Promise<void>;
	readonly onAddTag: (tagId: string) => Promise<void>;
}) {
	const { t } = useTranslation(["tags", "ui"]);
	const [selectedTag, setSelectedTag] = useState<PickedEntity>();
	const [selectedStructure, setSelectedStructure] = useState<PickedEntity>();
	return (
		<Card>
			<CardContent className="grid gap-6 p-4 sm:p-5">
				{hasDevelopmentPreviewAccess ? (
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
						{signedIn ? (
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
						) : (
							<SignInButton className="w-fit" variant="outline">
								{t.tags.structures.add}
							</SignInButton>
						)}
						<RequestFailure error={addStructureError} fallback={t.ui.retryLater} />
					</div>
				) : null}
				<div
					className={
						hasDevelopmentPreviewAccess
							? "grid gap-3 border-t border-border-weak pt-6"
							: "grid gap-3"
					}
				>
					<div className="grid gap-1">
						<h2 className="font-semibold">{t.tags.global.addTitle}</h2>
						<p className="text-sm text-muted-foreground">
							{t.tags.global.addDescription}
						</p>
					</div>
					{signedIn ? (
						<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
							<EntityPicker
								index="tags"
								onChange={setSelectedTag}
								value={selectedTag}
							/>
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
								{t.tags.global.add}
							</Button>
						</div>
					) : (
						<SignInButton className="w-fit" variant="outline">
							{t.tags.global.add}
						</SignInButton>
					)}
					<RequestFailure error={addError} fallback={t.ui.retryLater} />
				</div>
			</CardContent>
		</Card>
	);
}
