import { notFound } from "next/navigation";

import { ContentStructureEdit } from "@/features/units/content-structure-edit";

export default async function Page({
	params,
}: {
	params: Promise<{ type: string; unit: string }>;
}) {
	const { type, unit } = await params;
	if (type !== "book") notFound();
	return <ContentStructureEdit bookId={unit} />;
}
