import { notFound } from "next/navigation";

import { isStudioSectionId } from "@/features/create/model/studio-section";
import { StudioSectionPage } from "@/features/create/pages/studio-section-page";

export default async function Page({ params }: { readonly params: Promise<{ section: string }> }) {
	const { section } = await params;
	if (!isStudioSectionId(section)) notFound();
	return <StudioSectionPage sectionId={section} />;
}
