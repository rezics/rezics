import { isAvailableZonePageSlug, ZoneHomePageSlug } from "@rezics/slug";
import { notFound, permanentRedirect, redirect } from "next/navigation";

import { resolvePublicSlug } from "@/features/slugs/resolve-public-slug.server";
import { ZonePage } from "@/features/zones/zone-page";

export default async function Page({
	params,
}: {
	params: Promise<{ slug: string; page: string }>;
}) {
	const { slug, page } = await params;
	if (!isAvailableZonePageSlug(page)) notFound();
	const resolved = await resolvePublicSlug("zone", slug);
	if (!resolved) notFound();
	if (page === ZoneHomePageSlug) {
		if (resolved.redirected) redirect(resolved.canonicalHref);
		permanentRedirect(resolved.canonicalHref);
	}
	const canonicalHref = `${resolved.canonicalHref}/${page}`;
	if (resolved.redirected || canonicalHref !== `/z/${slug}/${page}`) redirect(canonicalHref);
	return (
		<ZonePage
			baseHref={resolved.canonicalHref}
			id={resolved.id}
			selection={{ by: "slug", slug: page }}
		/>
	);
}
