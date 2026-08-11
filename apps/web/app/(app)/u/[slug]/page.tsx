import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ProfilePage } from "@/features/profiles/profile-page";
import { UnitLandingStructuredData } from "@/features/seo/components/unit-landing-structured-data";
import { getUnitLandingSeoDocument } from "@/features/seo/data/unit-landing-seo.server";
import { resolvePublicSlug } from "@/features/slugs/resolve-public-slug.server";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;
	const resolved = await resolvePublicSlug("profile", slug);
	if (!resolved) notFound();
	return (
		await getUnitLandingSeoDocument({
			unitId: resolved.id,
			expectedKind: "profile",
			canonicalPath: resolved.canonicalHref,
		})
	).metadata;
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const resolved = await resolvePublicSlug("profile", slug);
	if (!resolved) notFound();
	if (resolved.redirected || resolved.canonicalHref !== `/u/${slug}`)
		redirect(resolved.canonicalHref);
	return (
		<>
			<UnitLandingStructuredData
				canonicalPath={resolved.canonicalHref}
				expectedKind="profile"
				unitId={resolved.id}
			/>
			<ProfilePage />
		</>
	);
}
