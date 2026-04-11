import { createHash } from "node:crypto";

// ============================================================
// DETERMINISTIC UUIDv5 FOR SEED TAGS
// ============================================================

const SEED_TAG_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"; // DNS namespace UUID

function uuidv5(name: string, namespace: string): string {
  const namespaceBytes = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const nameBytes = Buffer.from(name, "utf8");
  const hash = createHash("sha1")
    .update(namespaceBytes)
    .update(nameBytes)
    .digest();

  // Set version (5) and variant (RFC 4122)
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;

  const hex = hash.subarray(0, 16).toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

// ============================================================
// SEED TAG IDS
// ============================================================

export const SEED_TAG_NAMES = [
  "book",
  "game",
  "media",
  "post",
  "link",
] as const;

export type SeedTagName = (typeof SEED_TAG_NAMES)[number];

function buildSeedTagId(name: string): string {
  return uuidv5(`rezics:content-type:${name}`, SEED_TAG_NAMESPACE);
}

export const SEED_TAG_IDS = {
  book: buildSeedTagId("book"),
  game: buildSeedTagId("game"),
  media: buildSeedTagId("media"),
  post: buildSeedTagId("post"),
  link: buildSeedTagId("link"),
} as const satisfies Record<SeedTagName, string>;

export const SEED_TAG_TITLES: Record<SeedTagName, string> = {
  book: "Book",
  game: "Game",
  media: "Media",
  post: "Post",
  link: "Link",
};

export const SEED_TAG_SCORE = 1000;
