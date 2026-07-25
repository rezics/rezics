import { notFound, permanentRedirect } from "next/navigation";

import { ProfileSearchPage } from "@/features/profiles/profile-search-page";
import { getPublicSlugHrefByUnitId, isUuid } from "@/features/slugs/resolve-public-slug.server";

export default async function Page({ params }: { params: Promise<{ profileId: string }> }) {
	const { profileId } = await params;
	if (!isUuid(profileId)) notFound();
	const slugHref = await getPublicSlugHrefByUnitId("profile", profileId);
	if (slugHref) permanentRedirect(`${slugHref}/search`);
	return <ProfileSearchPage />;
}
