"use client";

import { toFiniteApiNumber } from "@/lib/api-number";
import { useTranslation } from "@/i18n/client";
import type { TagPresentation } from "../model/tag-presentation";
import type { TaggableUnitType } from "../model/taggable-unit";
import { TagBadgeCard } from "./tag-badge-card";

const ignoreReferenceInteraction = () => undefined;

/**
 * Presents a compact, read-only Tag reference through the canonical Tag card.
 *
 * The source surface may only have preview identity and score data, so voting
 * stays unavailable while the shared Tag popover, details link, and search
 * action remain available.
 */
export function TagReferenceBadge({
	pinned = false,
	score,
	tagId,
	title,
	type = "entity",
}: {
	readonly pinned?: boolean;
	readonly score?: string | number | null;
	readonly tagId: string;
	readonly title: string | null;
	readonly type?: TaggableUnitType;
}) {
	const { t } = useTranslation(["tags"]);
	const item = {
		itemKey: `global:${tagId}`,
		identity: {
			tagId,
			language: null,
			title,
			summary: null,
			avatar: null,
		},
		context: { kind: "global", pinned },
		vote: { kind: "not-applicable", reason: "read-only-reference" },
	} satisfies TagPresentation;

	return (
		<TagBadgeCard
			displayScore={toFiniteApiNumber(score)}
			fallbackLabel={t.tags.unnamedTag}
			isPending={false}
			item={item}
			onClearVote={ignoreReferenceInteraction}
			onToggleSelected={ignoreReferenceInteraction}
			onVote={ignoreReferenceInteraction}
			selected={false}
			selectionMode={false}
			type={type}
		/>
	);
}
