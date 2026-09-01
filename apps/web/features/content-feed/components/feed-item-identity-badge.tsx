"use client";

import { IdentityBadgeLink } from "@/features/block-composition/components/identity-badge-link";
import { useChineseContentText } from "@/features/content-language-display/chinese-content-display-context";
import { resolvePostPresentationTitle } from "@/features/posts/model/post-presentation-title";
import { postHref, type PostInteractionContext } from "@/features/posts/url";
import { publicUnitHref } from "@/features/units/routing/public-unit-route";
import { useTranslation } from "@/i18n/client";
import type { FeedItem } from "./feed-item-card";

export function FeedItemIdentityBadge({
	item,
	postContext,
}: {
	readonly item: FeedItem;
	readonly postContext?: PostInteractionContext;
}) {
	const { t } = useTranslation(["posts", "ui"]);
	const postTitle =
		item.itemType === "post"
			? resolvePostPresentationTitle(item, {
					reviewOf: t.posts.reviewFallbackTitle,
					reply: t.posts.replyPost,
					unknownAttribution: t.posts.unknownAttribution,
					unnamedSubject: t.ui.unnamed,
				})
			: null;
	const sourceLabel =
		item.itemType === "unit" ? (item.title ?? t.ui.unnamed) : (postTitle?.value ?? t.ui.unnamed);
	const sourceLanguage = item.itemType === "unit" ? item.language : postTitle?.language;
	const label = useChineseContentText(sourceLabel, sourceLanguage);

	if (item.itemType === "post")
		return <IdentityBadgeLink href={postHref(item.id, postContext)} label={label} />;
	return (
		<IdentityBadgeLink
			avatar={item.presentation.kind === "identity" ? item.presentation.avatar : null}
			href={publicUnitHref(item.unitKind, item)}
			label={label}
		/>
	);
}
