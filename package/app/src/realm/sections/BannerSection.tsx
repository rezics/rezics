import { postQueries } from "@rezics/api/post/post";
import { mainMarkdownSource, type RealmBannerExtra } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import * as m from "@rezics/i18n/messages";

export interface BannerSectionProps {
  banner?: RealmBannerExtra | null;
}

function getPostBannerUrl(post: unknown): string | undefined {
  const extra = (post as { extra?: Record<string, unknown> | null })?.extra;
  const coverUrl = extra?.coverUrl;
  if (typeof coverUrl === "string" && coverUrl.trim()) return coverUrl;

  const body =
    mainMarkdownSource((post as { content?: unknown })?.content) ?? "";
  const markdownImage = body.match(/!\[[^\]]*]\(([^)]+)\)/);
  return markdownImage?.[1];
}

function getPostBannerTitle(post: unknown): string {
  const body =
    mainMarkdownSource((post as { content?: unknown })?.content) ?? "";
  return body.trim().split("\n").find(Boolean) ?? m.realm_banner();
}

export const BannerSection: React.FC<BannerSectionProps> = ({ banner }) => {
  const postId = banner?.kind === "post" ? banner.unitId : undefined;
  const { data: post, isError } = useQuery({
    ...postQueries.detail(postId ?? ""),
    enabled: Boolean(postId),
  });

  if (!banner || isError) return null;

  if (banner.kind === "url") {
    return (
      <section className="overflow-hidden rounded-md bg-surface-subtle">
        <img
          src={banner.url}
          alt=""
          className="h-48 w-full object-cover md:h-64"
        />
      </section>
    );
  }

  if (!post) return null;

  const imageUrl = getPostBannerUrl(post);
  if (imageUrl) {
    return (
      <section className="overflow-hidden rounded-md bg-surface-subtle">
        <img
          src={imageUrl}
          alt=""
          className="h-48 w-full object-cover md:h-64"
        />
      </section>
    );
  }

  return (
    <section className="rounded-md bg-surface-subtle p-6">
      <p className="text-lg font-medium leading-ui text-text-primary">
        {getPostBannerTitle(post)}
      </p>
    </section>
  );
};
