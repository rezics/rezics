"use client";

import { Button } from "@rezics/ui";
import { Plus } from "lucide-react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useTranslation } from "@/i18n/client";
import type { TagSelectionOption } from "../model/tag-suggestion";
import { unitTagVoteCreateHref, type UnitTagVoteCreateTarget } from "../routing/tag-create-route";
import {
	TagSelectionMultiPicker,
	type TagSelectionCommitResult,
} from "./tag-selection-multi-picker";

export function UnitTagManagement({
	canVote,
	tagCreateTarget,
	onAddSelections,
}: {
	readonly canVote: boolean;
	readonly tagCreateTarget: UnitTagVoteCreateTarget;
	readonly onAddSelections: (
		selections: readonly TagSelectionOption[],
	) => Promise<readonly TagSelectionCommitResult[]>;
}) {
	const { t } = useTranslation(["tags", "ui"]);
	const contextKind = tagCreateTarget.context.kind;
	const contextRealmId =
		tagCreateTarget.context.kind === "realm" ? tagCreateTarget.context.realmId : undefined;
	if (!canVote) return null;
	const addCopy = contextKind === "global" ? t.tags.global : t.tags.realms;
	return (
		<div className="grid gap-6">
			<div className="grid gap-3">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="grid gap-1">
						<h2 className="font-semibold">{addCopy.addTitle}</h2>
						<p className="text-sm text-muted-foreground">{addCopy.addDescription}</p>
					</div>
					{tagCreateTarget.context.kind === "global" ? (
						<div className="flex flex-wrap gap-2">
							<Button asChild variant="outline">
								<Link href="/tag-paths/new">{t.tags.paths.create}</Link>
							</Button>
							<Button asChild variant="outline">
								<Link
									href={unitTagVoteCreateHref("", {
										type: tagCreateTarget.type,
										unitId: tagCreateTarget.unitId,
										context: { kind: "global" },
									})}
								>
									<Plus aria-hidden className="size-4" />
									{t.tags.create.title}
								</Link>
							</Button>
						</div>
					) : null}
				</div>
				<TagSelectionMultiPicker
					actionLabel={addCopy.add}
					ariaLabel={addCopy.addTitle}
					contextRealmId={contextRealmId}
					onCommit={onAddSelections}
					placeholder={t.ui.pickerPlaceholders.tag}
				/>
			</div>
		</div>
	);
}
