import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ProfileLayout } from "@/features/profiles/profile-layout";
import { isUuid } from "@/features/slugs/resolve-public-slug.server";

export default async function Layout({
	children,
	params,
}: {
	children: ReactNode;
	params: Promise<{ profileId: string }>;
}) {
	const { profileId } = await params;
	if (!isUuid(profileId)) notFound();
	return <ProfileLayout profileId={profileId}>{children}</ProfileLayout>;
}
