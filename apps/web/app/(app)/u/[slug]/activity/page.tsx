import { notFound, redirect } from "next/navigation";

import { ProfileActivityPage } from "@/features/profiles/profile-activity-page";
import { resolvePublicSlug } from "@/features/slugs/resolve-public-slug.server";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const resolved = await resolvePublicSlug("profile", slug);
	if (!resolved) notFound();
	if (resolved.redirected || resolved.canonicalHref !== `/u/${slug}`)
		redirect(`${resolved.canonicalHref}/activity`);
	return <ProfileActivityPage />;
}
