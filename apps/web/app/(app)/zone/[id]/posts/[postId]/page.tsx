import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { UnitLandingStructuredData } from "@/features/seo/components/unit-landing-structured-data";
import { withContentLanguage } from "@/features/content-languages/routing/content-language-route";
import {
	getRequestedUnitLandingLanguage,
	type UnitLandingSearchParams,
} from "@/features/seo/data/unit-landing-search-params.server";
import { getUnitLandingSeoDocument } from "@/features/seo/data/unit-landing-seo.server";
import { getPublicSlugHrefByUnitId, isUuid } from "@/features/slugs/resolve-public-slug.server";
import { ZonePostPage } from "@/features/zones/zone-post-page";

export async function generateMetadata({
	params,
	searchParams,
}: {
	params: Promise<{ id: string; postId: string }>;
	searchParams: UnitLandingSearchParams;
}): Promise<Metadata> {
	const [{ id, postId }, requestedLanguage] = await Promise.all([
		params,
		getRequestedUnitLandingLanguage(searchParams),
	]);
	if (!isUuid(id) || !isUuid(postId)) notFound();
	const slugHref = await getPublicSlugHrefByUnitId("zone", id);
	if (slugHref)
		permanentRedirect(withContentLanguage(`${slugHref}/posts/${postId}`, requestedLanguage));
	return (
		await getUnitLandingSeoDocument({
			unitId: postId,
			expectedKind: "post",
			canonicalPath: `/posts/${postId}`,
			requestedLanguage,
		})
	).metadata;
}

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ id: string; postId: string }>;
	searchParams: UnitLandingSearchParams;
}) {
	const [{ id, postId }, requestedLanguage] = await Promise.all([
		params,
		getRequestedUnitLandingLanguage(searchParams),
	]);
	if (!isUuid(id) || !isUuid(postId)) notFound();
	const slugHref = await getPublicSlugHrefByUnitId("zone", id);
	if (slugHref)
		permanentRedirect(withContentLanguage(`${slugHref}/posts/${postId}`, requestedLanguage));
	return (
		<>
			<UnitLandingStructuredData
				canonicalPath={`/posts/${postId}`}
				expectedKind="post"
				unitId={postId}
				requestedLanguage={requestedLanguage}
			/>
			<ZonePostPage baseHref={`/zone/${id}`} id={id} postId={postId} />
		</>
	);
}
