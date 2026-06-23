import { ClientOnly } from "@/components/ClientOnly";
import { PostDetailContent } from "./content";

interface PostDetailPageProps {
  readonly params: Promise<{ id: string }>;
}

export default async function PostDetailPage({ params }: PostDetailPageProps) {
  const { id } = await params;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <ClientOnly>
        <PostDetailContent id={id} />
      </ClientOnly>
    </div>
  );
}
