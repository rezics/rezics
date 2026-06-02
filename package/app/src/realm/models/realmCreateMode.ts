import type {
  CreatePostInput,
  Language,
  SubmitPostToRealmInput,
} from "@rezics/contract";
import { markdownContentDoc, PostKind } from "@rezics/contract";

export const realmCreateModes = ["post", "wiki", "poll", "existing"] as const;

export type RealmCreateMode = (typeof realmCreateModes)[number];

export const defaultRealmCreateMode: RealmCreateMode = "post";

export const realmCreateModeLabels: Record<RealmCreateMode, string> = {
  post: "Post",
  wiki: "Wiki",
  poll: "Polls",
  existing: "Existing",
};

export function isRealmCreateMode(value: unknown): value is RealmCreateMode {
  return (
    typeof value === "string" &&
    realmCreateModes.includes(value as RealmCreateMode)
  );
}

export function normalizeRealmCreateMode(value: unknown): RealmCreateMode {
  return isRealmCreateMode(value) ? value : defaultRealmCreateMode;
}

export function realmCreateModeLabel(mode: RealmCreateMode): string {
  return realmCreateModeLabels[mode];
}

export function buildRealmPostCreateInput(input: {
  realmId: string;
  title: string;
  content: string;
  language: Language;
  tagIds: string[];
  status: "DRAFT" | "PUBLISHED";
}): CreatePostInput {
  return {
    realmUnitIds: [input.realmId],
    tagIds: input.tagIds,
    kind: PostKind.POST,
    language: input.language,
    title: input.title.trim(),
    content: markdownContentDoc(input.content.trim()),
    status: input.status,
  };
}

export function buildRealmWikiCreateInput(input: {
  realmId: string;
  title: string;
  content: string;
  language: Language;
  status: "DRAFT" | "PUBLISHED";
}): Omit<CreatePostInput, "kind" | "creationMode"> {
  return {
    realmUnitIds: [input.realmId],
    title: input.title.trim(),
    content: markdownContentDoc(input.content.trim()),
    language: input.language,
    status: input.status,
  };
}

export function buildRealmPollPostCreateInput(input: {
  realmId: string;
  title: string;
  content: string;
  language: Language;
  tagIds: string[];
  pollUnitId: string;
  status: "DRAFT" | "PUBLISHED";
}): CreatePostInput {
  return {
    ...buildRealmPostCreateInput(input),
    extra: { poll: { unitId: input.pollUnitId } },
  };
}

export function buildRealmExistingPostSubmitInput(input: {
  realmId: string;
  tagIds: string[];
  source: "draft" | "published";
}): SubmitPostToRealmInput {
  return {
    realmUnitId: input.realmId,
    tagIds: input.tagIds,
    publish: input.source === "draft",
  };
}
