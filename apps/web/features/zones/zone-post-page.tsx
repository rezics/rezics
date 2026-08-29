"use client";

import { PostDetailPage } from "@/features/posts/pages/post-detail-page";
import { ZoneSurface } from "./components/zone-surface";
import { ZoneWikiPostContent } from "./components/block-renderer";

export function ZonePostPage({
	baseHref,
	id,
	postId,
}: {
	readonly baseHref: string;
	readonly id: string;
	readonly postId: string;
}) {
	return (
		<ZoneSurface baseHref={baseHref} id={id} postId={postId}>
			{(projection) => (
				<PostDetailPage
					context={{ kind: "zone", zone: projection.zone }}
					embedded
					id={postId}
					renderWikiBody={(post) => (
						<ZoneWikiPostContent language={post.language} value={post.body.content} />
					)}
				/>
			)}
		</ZoneSurface>
	);
}
