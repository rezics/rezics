import { canonicalHrefFromShortPath } from "@rezics/slug";
import { notFound, permanentRedirect } from "next/navigation";

import { resolvePublicSlug } from "@/features/slugs/resolve-public-slug.server";

export default async function Page({ params }: { params: Promise<{ slugPath: string[] }> }) {
	const slugPath = (await params).slugPath;
	const canonicalHref = canonicalHrefFromShortPath("z", slugPath);
	if (!canonicalHref) notFound();
	const resolved = await resolvePublicSlug("zone", slugPath[0] ?? "");
	if (!resolved) notFound();
	permanentRedirect(resolved.canonicalHref);
}
