/**
 * Underscore-prefix → namespace map for the Paraglide → i18next migration.
 * 下划线前缀 → 命名空间映射，用于 Paraglide → i18next 迁移。
 *
 * Each legacy flat-catalog key in `packages/i18n/messages/*.json` is split
 * by its first underscore; the resulting prefix is looked up here to find
 * the target namespace under `public/locales/<lng>/<ns>.json`.
 * `packages/i18n/messages/*.json` 中每个旧的扁平目录 key 按第一个下划线拆分；
 * 在此处查找得到的前缀，以确定 `public/locales/<lng>/<ns>.json` 下的目标命名空间。
 *
 * `NAMESPACES` below is the canonical, exhaustive namespace set; every
 * underscore prefix in `PREFIX_TO_NAMESPACE` maps to exactly one of them.
 * 下方的 `NAMESPACES` 是规范且穷尽的命名空间集合；`PREFIX_TO_NAMESPACE`
 * 中的每个下划线前缀都恰好映射到其中之一。
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
  // common — 跨领域词汇与无障碍标签
  common: "common",
  accessibility: "common",
  motto: "common",
  game: "common",

  // shell — app chrome, navigation, theme, language switcher
  // shell — 应用外壳、导航、主题、语言切换器
  layout: "shell",
  navigation: "shell",
  home: "shell",
  theme: "shell",
  app: "shell",
  language: "shell",
  media: "shell",

  auth: "auth",

  // book — books, chapters, releases, units
  // book — 书籍、章节、发布、单元
  book: "book",
  chapter: "book",
  chapters: "book",
  pages: "book",
  release: "book",
  units: "book",
  unit: "book",
  title: "book",

  // page — standalone pages and remarks
  // page — 独立页面与备注
  page: "page",
  remark: "page",

  // entity — works, attributions, collections, realms, shelves, pinboards
  // entity — 作品、署名、收藏集、realm、货架、图钉板
  entity: "entity",
  work: "entity",
  attribution: "entity",
  collection: "entity",
  realm: "entity",
  shelf: "entity",
  pinboard: "entity",

  // community — feedback, reviews, posts, reactions, tags, ratings, DMs
  // community — 反馈、评论、帖子、表态、标签、评分、私信
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

  search: "search",
  history: "search",
  zone: "search",

  // settings — user prefs, profile, notifications, ai
  // settings — 用户偏好、个人资料、通知、ai
  settings: "settings",
  profile: "settings",
  notifications: "settings",
  notify: "settings",
  ai: "settings",
  edit: "settings",
  user: "settings",
  license: "settings",

  editor: "editor",
  placeholders: "editor",
  authority: "editor",

  admin: "admin",
} as const satisfies Record<string, Namespace>;

export type Prefix = keyof typeof PREFIX_TO_NAMESPACE;

export function resolveNamespace(flatKey: string): Namespace {
  const underscore = flatKey.indexOf("_");
  const prefix = underscore >= 0 ? flatKey.slice(0, underscore) : flatKey;
  const namespace = (
    PREFIX_TO_NAMESPACE as Record<string, Namespace | undefined>
  )[prefix];
  if (!namespace) {
    throw new Error(
      `[i18n] No namespace mapping for prefix \`${prefix}\` (from key \`${flatKey}\`). ` +
        `Update tool/src/commands/i18n/namespace-map.ts.`,
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
 * 当旧前缀与命名空间相同时丢弃该前缀，因此 `book_title` → `book.json` 中的 key `title`，
 * 而 `book_chapter_title` → `book.json` 中的 key `chapter_title`。对于与命名空间字面不同的
 * 前缀（例如 `accessibility_close` → `common`），保留带前缀的 key 以避免命名空间内冲突。
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
