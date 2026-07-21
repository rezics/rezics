import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ProfileLayout } from "@/features/profiles/profile-layout";
import { resolvePublicSlug } from "@/features/slugs/resolve-public-slug.server";

export default async function Layout({
	children,
	params,
}: {
	children: ReactNode;
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const resolved = await resolvePublicSlug("profile", slug);
	if (!resolved) notFound();
	return <ProfileLayout profileId={resolved.id}>{children}</ProfileLayout>;
}
