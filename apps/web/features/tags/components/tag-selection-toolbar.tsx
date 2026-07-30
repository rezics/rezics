"use client";

import { Button } from "@rezics/ui";
import { Search, X } from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";

import type { UnitDetailUnitType } from "@/features/units/model/unit-detail-section";
import { useTranslation } from "@/i18n/client";
import type { TagIdentity } from "../model/tag-presentation";
import { tagSearchHref } from "../routing/tag-links";

export function TagSelectionToolbar({
	identities,
	labels,
	selectedTagIds,
	type,
	onClear,
	onFinish,
}: {
	readonly identities: ReadonlyMap<string, TagIdentity>;
	readonly labels: ReadonlyMap<string, string>;
	readonly selectedTagIds: readonly string[];
	readonly type: UnitDetailUnitType;
	readonly onClear: () => void;
	readonly onFinish: () => void;
}) {
	const { t } = useTranslation(["tags"]);
	const selected = selectedTagIds.flatMap((tagId) => {
		const identity = identities.get(tagId);
		return identity ? [identity] : [];
	});
	return (
		<div className="sticky bottom-4 z-20 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur">
			<p className="min-w-0 text-sm font-medium">
				{t.tags.selection.selectedCount({ count: selected.length })}
			</p>
			<div className="flex min-w-0 flex-wrap items-center gap-2">
				<Button disabled={!selected.length} onClick={onClear} size="sm" variant="quiet">
					{t.tags.selection.clear}
				</Button>
				{selected.length ? (
					<Button asChild className="min-w-0" size="sm">
						<Link
							href={tagSearchHref(
								type,
								selected.map((identity) => ({
									tagId: identity.tagId,
									label: labels.get(identity.tagId) ?? t.tags.unnamedTag,
								})),
							)}
						>
							<Search aria-hidden />
							<span className="truncate">{t.tags.selection.search}</span>
						</Link>
					</Button>
				) : (
					<Button className="min-w-0" disabled size="sm">
						<Search aria-hidden />
						<span className="truncate">{t.tags.selection.search}</span>
					</Button>
				)}
				<Button
					aria-label={t.tags.selection.finish}
					onClick={onFinish}
					size="icon-sm"
					variant="outline"
				>
					<X aria-hidden />
				</Button>
			</div>
		</div>
	);
}
