import { ProfilePage } from "@/features/profiles/profile-page";
import { getPublicSlugHrefByUnitId, isUuid } from "@/features/slugs/resolve-public-slug.server";
import { notFound, permanentRedirect } from "next/navigation";

export default async function Page({ params }: { params: Promise<{ profileId: string }> }) {
	const { profileId } = await params;
	if (!isUuid(profileId)) notFound();
	const slugHref = await getPublicSlugHrefByUnitId("profile", profileId);
	if (slugHref) permanentRedirect(slugHref);
	return <ProfilePage />;
}
