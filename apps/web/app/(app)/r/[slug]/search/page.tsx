import { notFound, redirect } from "next/navigation";

import { RealmSearchPage } from "@/features/realms/realm-search-page";
import { resolvePublicSlug } from "@/features/slugs/resolve-public-slug.server";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const resolved = await resolvePublicSlug("realm", slug);
	if (!resolved) notFound();
	const canonicalHref = `${resolved.canonicalHref}/search`;
	if (resolved.redirected || canonicalHref !== `/r/${slug}/search`) redirect(canonicalHref);
	return <RealmSearchPage realmId={resolved.id} />;
}
