import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { UnitLandingStructuredData } from "@/features/seo/components/unit-landing-structured-data";
import { withContentLanguage } from "@/features/content-languages/routing/content-language-route";
import {
	getRequestedUnitLandingLanguage,
	type UnitLandingSearchParams,
} from "@/features/seo/data/unit-landing-search-params.server";
import { getUnitLandingSeoDocument } from "@/features/seo/data/unit-landing-seo.server";
import { isUuid, resolvePublicSlug } from "@/features/slugs/resolve-public-slug.server";
import { ZonePostPage } from "@/features/zones/zone-post-page";

export async function generateMetadata({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string; postId: string }>;
	searchParams: UnitLandingSearchParams;
}): Promise<Metadata> {
	const [{ slug, postId }, requestedLanguage] = await Promise.all([
		params,
		getRequestedUnitLandingLanguage(searchParams),
	]);
	if (!isUuid(postId)) notFound();
	const resolved = await resolvePublicSlug("zone", slug);
	if (!resolved) notFound();
	const canonicalHref = `${resolved.canonicalHref}/posts/${postId}`;
	if (resolved.redirected || canonicalHref !== `/z/${slug}/posts/${postId}`)
		redirect(withContentLanguage(canonicalHref, requestedLanguage));
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
	params: Promise<{ slug: string; postId: string }>;
	searchParams: UnitLandingSearchParams;
}) {
	const [{ slug, postId }, requestedLanguage] = await Promise.all([
		params,
		getRequestedUnitLandingLanguage(searchParams),
	]);
	if (!isUuid(postId)) notFound();
	const resolved = await resolvePublicSlug("zone", slug);
	if (!resolved) notFound();
	const canonicalHref = `${resolved.canonicalHref}/posts/${postId}`;
	if (resolved.redirected || canonicalHref !== `/z/${slug}/posts/${postId}`)
		redirect(withContentLanguage(canonicalHref, requestedLanguage));
	return (
		<>
			<UnitLandingStructuredData
				canonicalPath={`/posts/${postId}`}
				expectedKind="post"
				unitId={postId}
				requestedLanguage={requestedLanguage}
			/>
			<ZonePostPage baseHref={resolved.canonicalHref} id={resolved.id} postId={postId} />
		</>
	);
}
