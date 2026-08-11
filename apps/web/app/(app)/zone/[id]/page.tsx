import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { UnitLandingStructuredData } from "@/features/seo/components/unit-landing-structured-data";
import { getUnitLandingSeoDocument } from "@/features/seo/data/unit-landing-seo.server";
import { getPublicSlugHrefByUnitId, isUuid } from "@/features/slugs/resolve-public-slug.server";
import { ZonePage } from "@/features/zones/zone-page";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const { id } = await params;
	if (!isUuid(id)) notFound();
	const canonicalPath = (await getPublicSlugHrefByUnitId("zone", id)) ?? `/zone/${id}`;
	return (await getUnitLandingSeoDocument({ unitId: id, expectedKind: "zone", canonicalPath }))
		.metadata;
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	if (!isUuid(id)) notFound();
	const slugHref = await getPublicSlugHrefByUnitId("zone", id);
	if (slugHref) permanentRedirect(slugHref);
	return (
		<>
			<UnitLandingStructuredData
				canonicalPath={`/zone/${id}`}
				expectedKind="zone"
				unitId={id}
			/>
			<ZonePage baseHref={`/zone/${id}`} id={id} />
		</>
	);
}
