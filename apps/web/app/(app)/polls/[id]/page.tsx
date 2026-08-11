import type { Metadata } from "next";

import { PollDetail } from "@/features/polls/polls";
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
			expectedKind: "poll",
			canonicalPath: `/polls/${id}`,
		})
	).metadata;
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const seo = { unitId: id, expectedKind: "poll", canonicalPath: `/polls/${id}` } as const;
	return (
		<>
			<UnitLandingStructuredData {...seo} />
			<PollDetail id={id} />
		</>
	);
}
