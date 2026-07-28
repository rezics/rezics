import { notFound, permanentRedirect } from "next/navigation";

import { getPublicSlugHrefByUnitId, isUuid } from "@/features/slugs/resolve-public-slug.server";
import { ZonePostPage } from "@/features/zones/zone-post-page";

export default async function Page({
	params,
}: {
	params: Promise<{ id: string; postId: string }>;
}) {
	const { id, postId } = await params;
	if (!isUuid(id) || !isUuid(postId)) notFound();
	const slugHref = await getPublicSlugHrefByUnitId("zone", id);
	if (slugHref) permanentRedirect(`${slugHref}/posts/${postId}`);
	return <ZonePostPage baseHref={`/zone/${id}`} id={id} postId={postId} />;
}
