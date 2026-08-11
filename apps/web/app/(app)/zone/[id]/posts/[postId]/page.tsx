import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { UnitLandingStructuredData } from "@/features/seo/components/unit-landing-structured-data";
import { getUnitLandingSeoDocument } from "@/features/seo/data/unit-landing-seo.server";
import { getPublicSlugHrefByUnitId, isUuid } from "@/features/slugs/resolve-public-slug.server";
import { ZonePostPage } from "@/features/zones/zone-post-page";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string; postId: string }>;
}): Promise<Metadata> {
	const { id, postId } = await params;
	if (!isUuid(id) || !isUuid(postId)) notFound();
	const slugHref = await getPublicSlugHrefByUnitId("zone", id);
	if (slugHref) permanentRedirect(`${slugHref}/posts/${postId}`);
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
	params: Promise<{ id: string; postId: string }>;
}) {
	const { id, postId } = await params;
	if (!isUuid(id) || !isUuid(postId)) notFound();
	const slugHref = await getPublicSlugHrefByUnitId("zone", id);
	if (slugHref) permanentRedirect(`${slugHref}/posts/${postId}`);
	return (
		<>
			<UnitLandingStructuredData
				canonicalPath={`/posts/${postId}`}
				expectedKind="post"
				unitId={postId}
			/>
			<ZonePostPage baseHref={`/zone/${id}`} id={id} postId={postId} />
		</>
	);
}
