import type { ContentLanguage } from "@rezics/i18n";
import { Badge } from "@rezics/ui";
import Link from "next/link";

import { LocalizedText } from "@/features/content-language-display/chinese-content-display-context";
import { tagDetailHref } from "../routing/tag-links";

export interface TagStructurePathMember {
	readonly tagId: string;
	readonly language?: ContentLanguage | null;
	readonly title: string | null;
}

export function TagStructurePath({
	ariaLabel,
	fallback,
	members,
}: {
	readonly ariaLabel: string;
	readonly fallback: string;
	readonly members: readonly TagStructurePathMember[];
}) {
	return (
		<ol aria-label={ariaLabel} className="flex flex-wrap items-center gap-2">
			{members.map((member, index) => (
				<li className="flex items-center gap-2" key={member.tagId}>
					{index > 0 ? (
						<span aria-hidden="true" className="text-muted-foreground">
							›
						</span>
					) : null}
					<Link href={tagDetailHref(member.tagId)}>
						<Badge variant="secondary">
							{member.title ? (
								<LocalizedText language={member.language} value={member.title} />
							) : (
								fallback
							)}
						</Badge>
					</Link>
				</li>
			))}
		</ol>
	);
}
