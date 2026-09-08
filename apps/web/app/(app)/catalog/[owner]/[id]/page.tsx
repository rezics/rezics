import type { Metadata } from "next";
import { CatalogLandingSeoBoundary } from "@/features/seo/components/catalog-landing-seo-boundary";
import { getUnitLandingSeoDocument } from "@/features/seo/data/unit-landing-seo.server";
import {
	getRequestedUnitLandingLanguage,
	type UnitLandingSearchParams,
} from "@/features/seo/data/unit-landing-search-params.server";
import { CatalogReferenceSchema } from "@rezics/reference";
import { notFound } from "next/navigation";
import { CatalogResourcePage } from "@/features/catalog/catalog-resource-page";

type RouteInput = {
	params: Promise<{ owner: string; id: string }>;
	searchParams: UnitLandingSearchParams;
};
export async function generateMetadata({ params, searchParams }: RouteInput): Promise<Metadata> {
	const value = await params,
		reference = CatalogReferenceSchema.safeParse({ ...value });
	if (!reference.success) notFound();
	const requestedLanguage = await getRequestedUnitLandingLanguage(searchParams);
	return (
		await getUnitLandingSeoDocument({
			unitId: reference.data.id,
			expectedOwner: reference.data.owner,
			canonicalPath: `/catalog/${reference.data.owner}/${reference.data.id}`,
			requestedLanguage,
		})
	).metadata;
}
export default async function Page({ params, searchParams }: RouteInput) {
	const reference = CatalogReferenceSchema.safeParse({ ...(await params) });
	if (!reference.success) notFound();
	const requestedLanguage = await getRequestedUnitLandingLanguage(searchParams);
	return (
		<CatalogLandingSeoBoundary reference={reference.data} requestedLanguage={requestedLanguage}>
			<CatalogResourcePage reference={reference.data} />
		</CatalogLandingSeoBoundary>
	);
}
