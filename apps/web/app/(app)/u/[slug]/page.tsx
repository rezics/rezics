import { notFound, permanentRedirect } from "next/navigation";

import { ProfilePage } from "@/features/profiles/profile-page";
import { resolvePublicSlug } from "@/features/slugs/resolve-public-slug.server";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const resolved = await resolvePublicSlug("profile", slug);
	if (!resolved) notFound();
	if (resolved.redirected || resolved.canonicalHref !== `/u/${slug}`)
		permanentRedirect(resolved.canonicalHref);
	return <ProfilePage />;
}
