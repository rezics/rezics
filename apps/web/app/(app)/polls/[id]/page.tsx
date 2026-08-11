import type { Metadata } from "next";

import { PollDetail } from "@/features/polls/polls";
import { UnitLandingStructuredData } from "@/features/seo/components/unit-landing-structured-data";
import {
	getRequestedUnitLandingLanguage,
	type UnitLandingSearchParams,
} from "@/features/seo/data/unit-landing-search-params.server";
import { getUnitLandingSeoDocument } from "@/features/seo/data/unit-landing-seo.server";

export async function generateMetadata({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: UnitLandingSearchParams;
}): Promise<Metadata> {
	const [{ id }, requestedLanguage] = await Promise.all([
		params,
		getRequestedUnitLandingLanguage(searchParams),
	]);
	return (
		await getUnitLandingSeoDocument({
			unitId: id,
			expectedKind: "poll",
			canonicalPath: `/polls/${id}`,
			requestedLanguage,
		})
	).metadata;
}

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: UnitLandingSearchParams;
}) {
	const [{ id }, requestedLanguage] = await Promise.all([
		params,
		getRequestedUnitLandingLanguage(searchParams),
	]);
	const seo = {
		unitId: id,
		expectedKind: "poll",
		canonicalPath: `/polls/${id}`,
		requestedLanguage,
	} as const;
	return (
		<>
			<UnitLandingStructuredData {...seo} />
			<PollDetail id={id} />
		</>
	);
}
