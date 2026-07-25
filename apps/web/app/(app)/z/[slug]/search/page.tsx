import { notFound, redirect } from "next/navigation";

import { resolvePublicSlug } from "@/features/slugs/resolve-public-slug.server";
import { ZoneSearchPage } from "@/features/zones/zone-search-page";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const resolved = await resolvePublicSlug("zone", slug);
	if (!resolved) notFound();
	const canonicalHref = `${resolved.canonicalHref}/search`;
	if (resolved.redirected || canonicalHref !== `/z/${slug}/search`) redirect(canonicalHref);
	return <ZoneSearchPage baseHref={resolved.canonicalHref} zoneId={resolved.id} />;
}
