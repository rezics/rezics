import type { ContentLanguage } from "@rezics/i18n";
import { Badge } from "@rezics/ui";
import { AppLink as Link } from "@/features/application-shell/components/app-link";

import { LocalizedText } from "@/features/content-language-display/chinese-content-display-context";
import { tagDetailHref } from "../routing/tag-links";

export interface TagPathPathMember {
	readonly nodeId: string;
	readonly nodeKind: "concept" | "guide";
	readonly language?: ContentLanguage | null;
	readonly title: string | null;
	readonly incomingRelation?: { readonly relationKind: string } | null;
}

export function TagPathPath({
	ariaLabel,
	fallback,
	linkMembers = true,
	members,
	relationLabel,
}: {
	readonly ariaLabel: string;
	readonly fallback: string;
	readonly linkMembers?: boolean;
	readonly members: readonly TagPathPathMember[];
	readonly relationLabel?: (relationKind: string) => string;
}) {
	return (
		<ol aria-label={ariaLabel} className="flex flex-wrap items-center gap-2">
			{members.map((member, index) => (
				<li className="flex items-center gap-2" key={member.nodeId}>
					{index > 0 ? (
						<span className="inline-flex items-center gap-1 text-muted-foreground">
							{member.incomingRelation && relationLabel ? (
								<span className="text-[0.6875rem]">
									{relationLabel(member.incomingRelation.relationKind)}
								</span>
							) : null}
							<span aria-hidden="true">›</span>
						</span>
					) : null}
					{member.nodeKind === "concept" && linkMembers ? (
						<Link href={tagDetailHref(member.nodeId)}>
							<Badge variant="secondary">
								{member.title ? (
									<LocalizedText language={member.language} value={member.title} />
								) : (
									fallback
								)}
							</Badge>
						</Link>
					) : (
						<Badge variant={member.nodeKind === "concept" ? "secondary" : "outline"}>
							{member.title ? (
								<LocalizedText language={member.language} value={member.title} />
							) : (
								fallback
							)}
						</Badge>
					)}
				</li>
			))}
		</ol>
	);
}
