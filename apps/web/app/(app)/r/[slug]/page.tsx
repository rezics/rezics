import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { RealmDetailPage } from "@/features/realms/realm-pages";
import { withContentLanguage } from "@/features/content-languages/routing/content-language-route";
import { UnitLandingStructuredData } from "@/features/seo/components/unit-landing-structured-data";
import {
	getRequestedUnitLandingLanguage,
	type UnitLandingSearchParams,
} from "@/features/seo/data/unit-landing-search-params.server";
import { getUnitLandingSeoDocument } from "@/features/seo/data/unit-landing-seo.server";
import { resolvePublicSlug } from "@/features/slugs/resolve-public-slug.server";

export async function generateMetadata({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>;
	searchParams: UnitLandingSearchParams;
}): Promise<Metadata> {
	const [{ slug }, requestedLanguage] = await Promise.all([
		params,
		getRequestedUnitLandingLanguage(searchParams),
	]);
	const resolved = await resolvePublicSlug("realm", slug);
	if (!resolved) notFound();
	return (
		await getUnitLandingSeoDocument({
			unitId: resolved.id,
			expectedKind: "realm",
			canonicalPath: resolved.canonicalHref,
			requestedLanguage,
		})
	).metadata;
}

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>;
	searchParams: UnitLandingSearchParams;
}) {
	const [{ slug }, requestedLanguage] = await Promise.all([
		params,
		getRequestedUnitLandingLanguage(searchParams),
	]);
	const resolved = await resolvePublicSlug("realm", slug);
	if (!resolved) notFound();
	if (resolved.redirected || resolved.canonicalHref !== `/r/${slug}`)
		redirect(withContentLanguage(resolved.canonicalHref, requestedLanguage));
	return (
		<>
			<UnitLandingStructuredData
				canonicalPath={resolved.canonicalHref}
				expectedKind="realm"
				unitId={resolved.id}
				requestedLanguage={requestedLanguage}
			/>
			<RealmDetailPage id={resolved.id} />
		</>
	);
}
