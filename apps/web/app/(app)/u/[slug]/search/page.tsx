import { notFound, redirect } from "next/navigation";

import { ProfileSearchPage } from "@/features/profiles/profile-search-page";
import { resolvePublicSlug } from "@/features/slugs/resolve-public-slug.server";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const resolved = await resolvePublicSlug("profile", slug);
	if (!resolved) notFound();
	const canonicalHref = `${resolved.canonicalHref}/search`;
	if (resolved.redirected || canonicalHref !== `/u/${slug}/search`) redirect(canonicalHref);
	return <ProfileSearchPage />;
}
