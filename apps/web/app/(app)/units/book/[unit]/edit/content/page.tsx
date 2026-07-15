import { ContentEdit } from "@/features/units/content-edit";
export default async function Page({ params }: { params: Promise<{ unit: string }> }) {
	return <ContentEdit bookId={(await params).unit} />;
}
