import { notFound, permanentRedirect } from "next/navigation";
import type { ReactNode } from "react";

import { ProfileLayout } from "@/features/profiles/profile-layout";
import { getPublicSlugHrefByUnitId, isUuid } from "@/features/slugs/resolve-public-slug.server";

export default async function Layout({
	children,
	params,
}: {
	children: ReactNode;
	params: Promise<{ profileId: string }>;
}) {
	const { profileId } = await params;
	if (!isUuid(profileId)) notFound();
	const canonicalHref = await getPublicSlugHrefByUnitId("profile", profileId);
	if (canonicalHref) permanentRedirect(canonicalHref);
	return <ProfileLayout profileId={profileId}>{children}</ProfileLayout>;
}
