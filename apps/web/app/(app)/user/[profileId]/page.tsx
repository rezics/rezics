import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { ProfilePage } from "@/features/profiles/profile-page";
import { UnitLandingStructuredData } from "@/features/seo/components/unit-landing-structured-data";
import { getUnitLandingSeoDocument } from "@/features/seo/data/unit-landing-seo.server";
import { getPublicSlugHrefByUnitId, isUuid } from "@/features/slugs/resolve-public-slug.server";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ profileId: string }>;
}): Promise<Metadata> {
	const { profileId } = await params;
	if (!isUuid(profileId)) notFound();
	const canonicalPath =
		(await getPublicSlugHrefByUnitId("profile", profileId)) ?? `/user/${profileId}`;
	return (
		await getUnitLandingSeoDocument({
			unitId: profileId,
			expectedKind: "profile",
			canonicalPath,
		})
	).metadata;
}

export default async function Page({ params }: { params: Promise<{ profileId: string }> }) {
	const { profileId } = await params;
	if (!isUuid(profileId)) notFound();
	const slugHref = await getPublicSlugHrefByUnitId("profile", profileId);
	if (slugHref) permanentRedirect(slugHref);
	return (
		<>
			<UnitLandingStructuredData
				canonicalPath={`/user/${profileId}`}
				expectedKind="profile"
				unitId={profileId}
			/>
			<ProfilePage />
		</>
	);
}
