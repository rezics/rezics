"use client";

import { Badge } from "@rezics/ui";

import { useTranslation } from "@/i18n/client";
import {
	renderTagExpressions,
	type TagExpressionRenderDefinition,
} from "../model/tag-expression-renderer";
import { TagReferenceBadge } from "./tag-reference-badge";

type SearchEvidence = "direct" | "primary" | "entailed" | "retrieval_only";

export interface SearchTagMatchReasonValue {
	readonly matchedTagId: string;
	readonly evidence: SearchEvidence;
	readonly expression: TagExpressionRenderDefinition;
}

export function SearchTagMatchReasons({
	matches,
}: {
	readonly matches: readonly SearchTagMatchReasonValue[];
}) {
	const { t } = useTranslation(["tags", "ui"]);
	const rendered = renderTagExpressions(
		matches.map((match) => ({
			authority: { kind: "global" as const },
			expression: match.expression,
			applications: [
				{
					applicationId: null,
					sourceKind: "definition" as const,
					pathId: null,
					members: [],
				},
			],
		})),
		{ unknownLabel: t.ui.unnamed },
	).flatMap((group) => group.items);
	const rows = matches.flatMap((match) => {
		const item = rendered.find(
			(candidate) => candidate.expressionId === match.expression.expressionId,
		);
		return item ? [{ match, item }] : [];
	});
	const first = rows[0];
	if (!first) return null;
	return (
		<div className="mt-3 grid gap-1.5 text-xs">
			<div className="flex flex-wrap items-center gap-1.5">
				<span className="font-medium text-muted-foreground">{t.tags.searchMatches.matched}</span>
				<TagReferenceBadge tagId={first.item.focusTagId} title={first.item.label} />
				<Badge variant="outline">{t.tags.searchMatches.evidence[first.match.evidence]}</Badge>
			</div>
			<details className="group">
				<summary className="w-fit cursor-pointer text-link hover:underline">
					{t.tags.searchMatches.why}
				</summary>
				<ul className="mt-2 grid gap-1.5 border-s border-border-weak ps-3">
					{rows.map(({ item, match }) => (
						<li className="flex flex-wrap items-center gap-1.5" key={item.key}>
							<TagReferenceBadge tagId={item.focusTagId} title={item.label} />
							<Badge variant="outline">{t.tags.searchMatches.evidence[match.evidence]}</Badge>
						</li>
					))}
				</ul>
			</details>
		</div>
	);
}
