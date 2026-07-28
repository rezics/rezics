import { notFound, redirect } from "next/navigation";

import { isUuid, resolvePublicSlug } from "@/features/slugs/resolve-public-slug.server";
import { ZonePostPage } from "@/features/zones/zone-post-page";

export default async function Page({
	params,
}: {
	params: Promise<{ slug: string; postId: string }>;
}) {
	const { slug, postId } = await params;
	if (!isUuid(postId)) notFound();
	const resolved = await resolvePublicSlug("zone", slug);
	if (!resolved) notFound();
	const canonicalHref = `${resolved.canonicalHref}/posts/${postId}`;
	if (resolved.redirected || canonicalHref !== `/z/${slug}/posts/${postId}`)
		redirect(canonicalHref);
	return <ZonePostPage baseHref={resolved.canonicalHref} id={resolved.id} postId={postId} />;
}
