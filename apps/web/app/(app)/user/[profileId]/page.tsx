import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { ProfilePage } from "@/features/profiles/profile-page";
import { withContentLanguage } from "@/features/content-languages/routing/content-language-route";
import { UnitLandingStructuredData } from "@/features/seo/components/unit-landing-structured-data";
import {
	getRequestedUnitLandingLanguage,
	type UnitLandingSearchParams,
} from "@/features/seo/data/unit-landing-search-params.server";
import { getUnitLandingSeoDocument } from "@/features/seo/data/unit-landing-seo.server";
import { getPublicSlugHrefByUnitId, isUuid } from "@/features/slugs/resolve-public-slug.server";

export async function generateMetadata({
	params,
	searchParams,
}: {
	params: Promise<{ profileId: string }>;
	searchParams: UnitLandingSearchParams;
}): Promise<Metadata> {
	const [{ profileId }, requestedLanguage] = await Promise.all([
		params,
		getRequestedUnitLandingLanguage(searchParams),
	]);
	if (!isUuid(profileId)) notFound();
	const canonicalPath =
		(await getPublicSlugHrefByUnitId("profile", profileId)) ?? `/user/${profileId}`;
	return (
		await getUnitLandingSeoDocument({
			unitId: profileId,
			expectedKind: "profile",
			canonicalPath,
			requestedLanguage,
		})
	).metadata;
}

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ profileId: string }>;
	searchParams: UnitLandingSearchParams;
}) {
	const [{ profileId }, requestedLanguage] = await Promise.all([
		params,
		getRequestedUnitLandingLanguage(searchParams),
	]);
	if (!isUuid(profileId)) notFound();
	const slugHref = await getPublicSlugHrefByUnitId("profile", profileId);
	if (slugHref) permanentRedirect(withContentLanguage(slugHref, requestedLanguage));
	return (
		<>
			<UnitLandingStructuredData
				canonicalPath={`/user/${profileId}`}
				expectedKind="profile"
				unitId={profileId}
				requestedLanguage={requestedLanguage}
			/>
			<ProfilePage />
		</>
	);
}
