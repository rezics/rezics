import { notFound } from "next/navigation";

import {
	isStudioGenericCreateSectionId,
	type StudioCreateSearchParams,
} from "@/features/create/model/studio-section";
import { StudioCreatePage } from "@/features/create/pages/studio-create-page";

export default async function Page({
	params,
	searchParams,
}: {
	readonly params: Promise<{ section: string }>;
	readonly searchParams: Promise<StudioCreateSearchParams>;
}) {
	const [{ section }, query] = await Promise.all([params, searchParams]);
	if (!isStudioGenericCreateSectionId(section)) notFound();
	return <StudioCreatePage searchParams={query} sectionId={section} />;
}
