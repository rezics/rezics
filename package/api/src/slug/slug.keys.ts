import type { SlugResolvePayload } from "@rezics/contract";

export const slugKeys = {
  all: ["slug"] as const,
  resolve: (input: SlugResolvePayload) =>
    [...slugKeys.all, "resolve", input.scope, input.slug] as const,
  userBySlug: (slug: string) => [...slugKeys.all, "user", slug] as const,
  entityBySlug: (slug: string) => [...slugKeys.all, "entity", slug] as const,
  shelfBySlug: (userSlug: string, slug: string) =>
    [...slugKeys.all, "shelf", userSlug, slug] as const,
};
