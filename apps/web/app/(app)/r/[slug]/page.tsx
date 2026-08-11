import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { RealmDetailPage } from "@/features/realms/realm-pages";
import { UnitLandingStructuredData } from "@/features/seo/components/unit-landing-structured-data";
import { getUnitLandingSeoDocument } from "@/features/seo/data/unit-landing-seo.server";
import { resolvePublicSlug } from "@/features/slugs/resolve-public-slug.server";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;
	const resolved = await resolvePublicSlug("realm", slug);
	if (!resolved) notFound();
	return (
		await getUnitLandingSeoDocument({
			unitId: resolved.id,
			expectedKind: "realm",
			canonicalPath: resolved.canonicalHref,
		})
	).metadata;
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const resolved = await resolvePublicSlug("realm", slug);
	if (!resolved) notFound();
	if (resolved.redirected || resolved.canonicalHref !== `/r/${slug}`)
		redirect(resolved.canonicalHref);
	return (
		<>
			<UnitLandingStructuredData
				canonicalPath={resolved.canonicalHref}
				expectedKind="realm"
				unitId={resolved.id}
			/>
			<RealmDetailPage id={resolved.id} />
		</>
	);
}
