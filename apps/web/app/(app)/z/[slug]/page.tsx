import { notFound, permanentRedirect } from "next/navigation";

import { resolvePublicSlug } from "@/features/slugs/resolve-public-slug.server";
import { ZonePage } from "@/features/zones/zone-page";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const resolved = await resolvePublicSlug("zone", slug);
	if (!resolved) notFound();
	if (resolved.redirected || resolved.canonicalHref !== `/z/${slug}`)
		permanentRedirect(resolved.canonicalHref);
	return <ZonePage id={resolved.id} />;
}
