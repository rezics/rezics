"use client";

import { useTranslation } from "@/i18n/client";
import {
	renderTagExpressions,
	type TagExpressionRenderDefinition,
} from "../model/tag-expression-renderer";
import { TagReferenceBadge } from "./tag-reference-badge";

/** Compact, definition-only projection for Association and Search previews. */
export function TagExpressionPreview({
	compact = true,
	expressions,
}: {
	readonly compact?: boolean;
	readonly expressions: readonly TagExpressionRenderDefinition[];
}) {
	const { t } = useTranslation(["tags", "ui"]);
	const groups = renderTagExpressions(
		expressions.map((expression) => ({
			authority: { kind: "global" as const },
			expression,
			applications: [
				{
					applicationId: null,
					sourceKind: "definition" as const,
					pathId: null,
					members: [],
				},
			],
		})),
		{
			groupByExpressionKey: true,
			unknownLabel: t.ui.unnamed,
		},
	);
	if (!groups.length) return null;
	return (
		<div className={compact ? "mt-3 line-clamp-2 text-xs" : "text-sm"}>
			{groups.map((group) => (
				<span className="me-2 inline-flex flex-wrap items-center gap-1" key={group.key}>
					{group.groupKey ? (
						<span className="font-semibold text-muted-foreground">{group.groupKey.title}</span>
					) : null}
					{group.items.map((item) => (
						<TagReferenceBadge key={item.key} tagId={item.focusTagId} title={item.label} />
					))}
				</span>
			))}
		</div>
	);
}
