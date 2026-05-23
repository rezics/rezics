import { postQueries } from "@rezics/api/post/post";
import { mainMarkdownSource } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { PostBodyMarkdown } from "@/post";

export interface AboutSectionProps {
  postUnitId?: string | null;
}

export const AboutSection: React.FC<AboutSectionProps> = ({ postUnitId }) => {
  const { data: post, isError } = useQuery({
    ...postQueries.detail(postUnitId ?? ""),
    enabled: Boolean(postUnitId),
  });

  const markdown = mainMarkdownSource(post?.content);
  if (!postUnitId || isError || !post || !markdown) return null;

  return (
    <section className="rounded-md bg-surface-subtle p-4">
      <h2 className="text-sm font-medium leading-ui text-text-primary">
        About
      </h2>
      <PostBodyMarkdown
        content={post.content}
        clamp={{ maxLines: 8 }}
        className="mt-2 text-sm leading-body text-text-secondary"
      />
    </section>
  );
};
