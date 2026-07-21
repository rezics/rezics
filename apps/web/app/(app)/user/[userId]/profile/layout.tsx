import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ProfileLayout } from "@/features/profiles/profile-layout";

const UuidPattern =
	/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

export default async function Layout({
	children,
	params,
}: {
	children: ReactNode;
	params: Promise<{ userId: string }>;
}) {
	const { userId } = await params;
	if (!UuidPattern.test(userId)) notFound();
	return <ProfileLayout id={userId}>{children}</ProfileLayout>;
}
