import { ContentStructureEdit } from "@/features/units/content-structure-edit";
export default async function Page({ params }: { params: Promise<{ unit: string }> }) {
	return <ContentStructureEdit bookId={(await params).unit} />;
}
