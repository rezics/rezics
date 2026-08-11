import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { UnitLandingStructuredData } from "@/features/seo/components/unit-landing-structured-data";
import { getUnitLandingSeoDocument } from "@/features/seo/data/unit-landing-seo.server";
import { isUuid, resolvePublicSlug } from "@/features/slugs/resolve-public-slug.server";
import { ZonePostPage } from "@/features/zones/zone-post-page";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string; postId: string }>;
}): Promise<Metadata> {
	const { slug, postId } = await params;
	if (!isUuid(postId)) notFound();
	const resolved = await resolvePublicSlug("zone", slug);
	if (!resolved) notFound();
	const canonicalHref = `${resolved.canonicalHref}/posts/${postId}`;
	if (resolved.redirected || canonicalHref !== `/z/${slug}/posts/${postId}`)
		redirect(canonicalHref);
	return (
		await getUnitLandingSeoDocument({
			unitId: postId,
			expectedKind: "post",
			canonicalPath: `/posts/${postId}`,
		})
	).metadata;
}

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
	return (
		<>
			<UnitLandingStructuredData
				canonicalPath={`/posts/${postId}`}
				expectedKind="post"
				unitId={postId}
			/>
			<ZonePostPage baseHref={resolved.canonicalHref} id={resolved.id} postId={postId} />
		</>
	);
}
