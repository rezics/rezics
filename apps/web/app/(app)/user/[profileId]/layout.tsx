import { notFound, permanentRedirect } from "next/navigation";
import type { ReactNode } from "react";

import { ProfileLayout } from "@/features/profiles/profile-layout";
import { resolvePublicSlug } from "@/features/slugs/resolve-public-slug.server";

export default async function Layout({
	children,
	params,
}: {
	children: ReactNode;
	params: Promise<{ profileId: string }>;
}) {
	const { profileId: slug } = await params;
	const resolved = await resolvePublicSlug("profile", slug);
	if (!resolved) notFound();
	if (resolved.redirected || resolved.canonicalHref !== `/user/${slug}`)
		permanentRedirect(resolved.canonicalHref);
	return <ProfileLayout profileId={resolved.id}>{children}</ProfileLayout>;
}
