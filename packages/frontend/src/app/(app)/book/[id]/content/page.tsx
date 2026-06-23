import { redirect } from "next/navigation";

// Redirect /book/[id]/content to /book/[id] (content is the default tab)
// 将 /book/[id]/content 重定向到 /book/[id]（内容为默认标签页）
export default async function BookContentRedirect({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/book/${id}`);
}
