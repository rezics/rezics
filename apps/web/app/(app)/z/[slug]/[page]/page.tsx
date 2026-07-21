import { notFound, redirect } from "next/navigation";

import { resolvePublicSlug } from "@/features/slugs/resolve-public-slug.server";
import { ZonePage } from "@/features/zones/zone-page";

export default async function Page({
	params,
}: {
	params: Promise<{ slug: string; page: string }>;
}) {
	const { slug, page } = await params;
	const resolved = await resolvePublicSlug("zone", slug);
	if (!resolved) notFound();
	const canonicalHref = `${resolved.canonicalHref}/${page}`;
	if (resolved.redirected || canonicalHref !== `/z/${slug}/${page}`) redirect(canonicalHref);
	return <ZonePage baseHref={resolved.canonicalHref} id={resolved.id} page={page} />;
}
