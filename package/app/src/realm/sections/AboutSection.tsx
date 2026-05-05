import { postQueries } from "@rezics/api/post/post";
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

  if (!postUnitId || isError || !post?.body) return null;

  return (
    <section className="rounded-md bg-surface-subtle p-4">
      <h2 className="text-sm font-medium leading-ui text-text-primary">
        About
      </h2>
      <PostBodyMarkdown
        body={post.body}
        clamp={{ maxLines: 8 }}
        className="mt-2 text-sm leading-body text-text-secondary"
      />
    </section>
  );
};
