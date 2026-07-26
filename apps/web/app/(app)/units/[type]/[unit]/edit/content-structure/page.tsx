import { notFound } from "next/navigation";

import { ContentStructurePage } from "@/features/units/pages/content-structure-page";

export default async function Page({
	params,
}: {
	params: Promise<{ type: string; unit: string }>;
}) {
	const { type, unit } = await params;
	if (type !== "book" && type !== "media" && type !== "software") notFound();
	return <ContentStructurePage type={type} unitId={unit} />;
}
