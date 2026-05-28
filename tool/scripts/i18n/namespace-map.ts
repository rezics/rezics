/**
 * Underscore-prefix → namespace map for the Paraglide → i18next migration.
 *
 * Each legacy flat-catalog key in `package/i18n/messages/*.json` is split
 * by its first underscore; the resulting prefix is looked up here to find
 * the target namespace under `public/locales/<lng>/<ns>.json`.
 *
 * The set of namespaces is defined by
 * `openspec/specs/i18n-namespace-architecture/spec.md`.
 */

export const NAMESPACES = [
  "common",
  "shell",
  "auth",
  "book",
  "page",
  "entity",
  "community",
  "search",
  "settings",
  "editor",
  "admin",
  "ui",
] as const;

export type Namespace = (typeof NAMESPACES)[number];

export const PREFIX_TO_NAMESPACE = {
  // common — cross-domain words and a11y labels
  common: "common",
  accessibility: "common",
  motto: "common",
  game: "common",

  // shell — app chrome, navigation, theme, language switcher
  layout: "shell",
  navigation: "shell",
  home: "shell",
  theme: "shell",
  app: "shell",
  language: "shell",
  media: "shell",

  // auth
  auth: "auth",

  // book — books, chapters, releases, units
  book: "book",
  chapter: "book",
  chapters: "book",
  pages: "book",
  release: "book",
  units: "book",
  unit: "book",
  title: "book",

  // page — standalone pages and remarks
  page: "page",
  remark: "page",

  // entity — works, attributions, collections, realms, shelves, pinboards
  entity: "entity",
  work: "entity",
  attribution: "entity",
  collection: "entity",
  realm: "entity",
  shelf: "entity",
  pinboard: "entity",

  // community — feedback, reviews, posts, reactions, tags, ratings, DMs
  feedback: "community",
  review: "community",
  progress: "community",
  post: "community",
  comment: "community",
  reactions: "community",
  tag: "community",
  excerpt: "community",
  rating: "community",
  score: "community",
  discussion: "community",
  engagement: "community",
  dm: "community",
  inbox: "community",

  // search
  search: "search",
  history: "search",
  zone: "search",

  // settings — user prefs, profile, notifications, ai
  settings: "settings",
  profile: "settings",
  notifications: "settings",
  notify: "settings",
  ai: "settings",
  edit: "settings",
  user: "settings",
  license: "settings",

  // editor
  editor: "editor",
  placeholders: "editor",
  authority: "editor",

  // admin
  admin: "admin",
} as const satisfies Record<string, Namespace>;

export type Prefix = keyof typeof PREFIX_TO_NAMESPACE;

export function resolveNamespace(flatKey: string): Namespace {
  const underscore = flatKey.indexOf("_");
  const prefix =
    underscore >= 0 ? flatKey.slice(0, underscore) : flatKey;
  const namespace = (
    PREFIX_TO_NAMESPACE as Record<string, Namespace | undefined>
  )[prefix];
  if (!namespace) {
    throw new Error(
      `[i18n] No namespace mapping for prefix \`${prefix}\` (from key \`${flatKey}\`). ` +
        `Update tool/scripts/i18n/namespace-map.ts.`,
    );
  }
  return namespace;
}

/**
 * Drop the legacy prefix when it equals the namespace, so
 * `book_title` → `book.json` with key `title`, but `book_chapter_title` →
 * `book.json` with key `chapter_title`. For prefixes that are not literally
 * the same as the namespace (e.g. `accessibility_close` → `common`), keep
 * the prefix-suffixed key to avoid collisions inside the namespace.
 */
export function resolveNamespacedKey(flatKey: string): {
  ns: Namespace;
  key: string;
} {
  const ns = resolveNamespace(flatKey);
  const underscore = flatKey.indexOf("_");
  const prefix = underscore >= 0 ? flatKey.slice(0, underscore) : flatKey;
  const suffix = underscore >= 0 ? flatKey.slice(underscore + 1) : "";
  const key = prefix === ns && suffix ? suffix : flatKey;
  return { ns, key };
}
