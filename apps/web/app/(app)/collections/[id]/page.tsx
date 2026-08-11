import type { Metadata } from "next";

import { CollectionDetailPage } from "@/features/collections/pages/collection-detail-page";
import { UnitLandingStructuredData } from "@/features/seo/components/unit-landing-structured-data";
import { getUnitLandingSeoDocument } from "@/features/seo/data/unit-landing-seo.server";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const { id } = await params;
	return (
		await getUnitLandingSeoDocument({
			unitId: id,
			expectedKind: "collection",
			canonicalPath: `/collections/${id}`,
		})
	).metadata;
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const seo = {
		unitId: id,
		expectedKind: "collection",
		canonicalPath: `/collections/${id}`,
	} as const;
	return (
		<>
			<UnitLandingStructuredData {...seo} />
			<CollectionDetailPage collectionId={id} />
		</>
	);
}
