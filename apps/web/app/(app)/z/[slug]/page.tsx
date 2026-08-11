import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { UnitLandingStructuredData } from "@/features/seo/components/unit-landing-structured-data";
import { getUnitLandingSeoDocument } from "@/features/seo/data/unit-landing-seo.server";
import { resolvePublicSlug } from "@/features/slugs/resolve-public-slug.server";
import { ZonePage } from "@/features/zones/zone-page";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;
	const resolved = await resolvePublicSlug("zone", slug);
	if (!resolved) notFound();
	return (
		await getUnitLandingSeoDocument({
			unitId: resolved.id,
			expectedKind: "zone",
			canonicalPath: resolved.canonicalHref,
		})
	).metadata;
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const resolved = await resolvePublicSlug("zone", slug);
	if (!resolved) notFound();
	if (resolved.redirected || resolved.canonicalHref !== `/z/${slug}`)
		redirect(resolved.canonicalHref);
	return (
		<>
			<UnitLandingStructuredData
				canonicalPath={resolved.canonicalHref}
				expectedKind="zone"
				unitId={resolved.id}
			/>
			<ZonePage baseHref={resolved.canonicalHref} id={resolved.id} />
		</>
	);
}
