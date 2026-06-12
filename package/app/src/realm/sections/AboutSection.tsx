import { postQueries } from "@rezics/api/post/post";
import { mainMarkdownSource } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { PostBodyMarkdown } from "@/post";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";

/**
 * Compact about section displaying realm description as rendered markdown.
 * Fetches a post by ID and renders its content clamped to 8 lines.
 * Returns null if post ID is missing, error occurs, or no markdown content.
 *
 * 显示社区描述的紧凑关于部分，渲染为Markdown。
 * 按ID获取帖子并将其内容限制为8行渲染。
 * 如果帖子ID缺失、出错或无Markdown内容，返回null。
 *
 * Layout:
 * Mobile (<640px):
 * ┌──────────────────────────┐
 * │ About                    │
 * ├──────────────────────────┤
 * │ About section text       │
 * │ rendered as markdown     │
 * │ clamped to max 8 lines   │
 * │ with overflow ellipsis   │
 * └──────────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌────────────────────────────────────┐
 * │ About                              │
 * ├────────────────────────────────────┤
 * │ About section text rendered as     │
 * │ markdown clamped to max 8 lines    │
 * │ with overflow ellipsis             │
 * └────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌──────────────────────────────────────┐
 * │ About                                │
 * ├──────────────────────────────────────┤
 * │ About section text rendered as      │
 * │ markdown clamped to max 8 lines     │
 * │ with overflow ellipsis              │
 * └──────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * Same as Desktop - full width section
 */
export interface AboutSectionProps {
  postUnitId?: string | null;
}

export const AboutSection: React.FC<AboutSectionProps> = ({ postUnitId }) => {
  const readContext = useReadLanguageContext();
  const { data: post, isError } = useQuery({
    ...postQueries.detail(postUnitId ?? "", {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    }),
    enabled: readContext.ready && Boolean(postUnitId),
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
