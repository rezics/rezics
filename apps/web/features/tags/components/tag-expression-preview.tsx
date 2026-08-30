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
	if (!compact)
		return (
			<div className="mt-4 grid gap-3 text-sm">
				{groups.map((group) => (
					<div
						className={
							group.groupKey
								? "grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start"
								: "grid gap-2"
						}
						key={group.key}
					>
						{group.groupKey ? (
							<div className="pt-1 font-semibold text-muted-foreground">{group.groupKey.title}</div>
						) : null}
						<div className="flex flex-wrap gap-2">
							{group.items.map((item) => (
								<TagReferenceBadge key={item.key} tagId={item.focusTagId} title={item.label} />
							))}
						</div>
					</div>
				))}
			</div>
		);
	return (
		<div className="mt-3 line-clamp-2 text-xs">
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
