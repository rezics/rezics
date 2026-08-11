"use client";

import type { ContentLanguage } from "@rezics/i18n";
import { PencilIcon } from "lucide-react";
import { AppLink as Link } from "@/features/application-shell/components/app-link";

import { MenuItem } from "@rezics/ui";
import { FeedOverflowMenu } from "@/features/content-feed/components/feed-card-actions";
import { ContentLanguageVersionMenu } from "@/features/content-languages/components/content-language-version-menu";
import { useTranslation } from "@/i18n/client";

/** Describes the only two safe edit transitions exposed by the shared menu. */
export type PostOverflowEditAction =
	| Readonly<{ kind: "link"; href: string }>
	| Readonly<{ kind: "command"; onSelect: () => void }>;

/**
 * Extends the shared feed overflow menu with management actions for a Post.
 *
 * @alpha
 */
export function PostOverflowMenu({
	availableLanguages,
	contentHref,
	currentLanguage,
	editAction,
	postId,
	realmId,
}: {
	readonly availableLanguages?: readonly ContentLanguage[];
	readonly contentHref?: string;
	readonly currentLanguage?: ContentLanguage;
	readonly editAction?: PostOverflowEditAction;
	readonly postId: string;
	readonly realmId?: string;
}) {
	const { t } = useTranslation(["ui"]);

	return (
		<FeedOverflowMenu canExclude={false} itemId={postId} reportTarget={{ unitId: postId, realmId }}>
			{availableLanguages && currentLanguage ? (
				<ContentLanguageVersionMenu
					availableLanguages={availableLanguages}
					baseHref={contentHref}
					currentLanguage={currentLanguage}
				/>
			) : null}
			{editAction?.kind === "link" ? (
				<MenuItem asChild value="edit-post">
					<Link href={editAction.href}>
						<PencilIcon aria-hidden />
						{t.ui.edit}
					</Link>
				</MenuItem>
			) : editAction?.kind === "command" ? (
				<MenuItem onSelect={editAction.onSelect} value="edit-post">
					<PencilIcon aria-hidden />
					{t.ui.edit}
				</MenuItem>
			) : null}
		</FeedOverflowMenu>
	);
}
