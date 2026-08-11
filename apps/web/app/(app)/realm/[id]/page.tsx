import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import { RealmDetailPage } from "@/features/realms/realm-pages";
import { UnitLandingStructuredData } from "@/features/seo/components/unit-landing-structured-data";
import { getUnitLandingSeoDocument } from "@/features/seo/data/unit-landing-seo.server";
import { getPublicSlugHrefByUnitId, isUuid } from "@/features/slugs/resolve-public-slug.server";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const { id } = await params;
	if (!isUuid(id)) notFound();
	const canonicalPath = (await getPublicSlugHrefByUnitId("realm", id)) ?? `/realm/${id}`;
	return (
		await getUnitLandingSeoDocument({
			unitId: id,
			expectedKind: "realm",
			canonicalPath,
		})
	).metadata;
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	if (!isUuid(id)) notFound();
	const slugHref = await getPublicSlugHrefByUnitId("realm", id);
	if (slugHref) permanentRedirect(slugHref);
	return (
		<>
			<UnitLandingStructuredData
				canonicalPath={`/realm/${id}`}
				expectedKind="realm"
				unitId={id}
			/>
			<RealmDetailPage id={id} />
		</>
	);
}
