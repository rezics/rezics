export type SlugValidationResult =
  | { ok: true; normalized: string }
  | { ok: false; reason: string };

const DEFAULT_RESERVED = [
  // roles / identities
  // 角色 / 身份
  "admin",
  "administrator",
  "moderator",
  "staff",
  "support",
  "official",
  "system",
  "root",
  "owner",
  "security",
  // auth / account
  // 认证 / 账户
  "login",
  "logout",
  "signin",
  "signup",
  "register",
  "account",
  "settings",
  "password",
  "oauth",
  "auth",
  // product / navigation
  // 产品 / 导航
  "help",
  "docs",
  "blog",
  "news",
  "status",
  "about",
  "terms",
  "privacy",
  "contact",
  "pricing",
  "billing",
  // technical / routing
  // 技术 / 路由
  "api",
  "graphql",
  "assets",
  "static",
  "cdn",
  "webhook",
  "callback",
  // special mappings
  // 特殊映射
  "me",
  "you",
  "null",
  "undefined",
] as const;

// Build Set once in module initialization for O(1) lookup.
// 在模块初始化时构建一次 Set，以实现 O(1) 查找。
const DEFAULT_RESERVED_SET: ReadonlySet<string> = new Set(DEFAULT_RESERVED);

export interface ValidateSlugOptions {
  minLen?: number; // default 6 — 默认 6
  maxLen?: number; // default 32 — 默认 32
  reserved?: ReadonlySet<string>; // default DEFAULT_RESERVED_SET — 默认 DEFAULT_RESERVED_SET
  trim?: boolean; // default true — 默认 true
}

export function validateSlug(
  input: string,
  opts: ValidateSlugOptions = {},
): SlugValidationResult {
  const minLen = opts.minLen ?? 6;
  const maxLen = opts.maxLen ?? 32;
  const reserved = opts.reserved ?? DEFAULT_RESERVED_SET;

  // Normalization: trim + lower (only once)
  // 规范化：trim + lower（仅执行一次）
  const s = opts.trim === false ? input : input.trim();
  if (s.length === 0) return { ok: false, reason: "empty" };
  // s = s.toLowerCase(); // Allow uppercase letters — 允许大写字母

  const len = s.length;
  if (len < minLen)
    return {
      ok: false,
      reason: `too_short, at least ${minLen} characters long`,
    };
  if (len > maxLen)
    return {
      ok: false,
      reason: `too_long, at most ${maxLen} characters long`,
    };

  // First and last character '-' check (O(1))
  // 检查首尾字符是否为 '-'（O(1)）
  if (s.charCodeAt(0) === 45) return { ok: false, reason: "leading_hyphen" };
  if (s.charCodeAt(len - 1) === 45)
    return { ok: false, reason: "trailing_hyphen" };

  // Reserved word check (can be done before/after character validation; placing it here can reject hotspots faster)
  // 保留字检查（可在字符校验前后进行；放在此处能更快拒绝高频命中项）
  if (reserved.has(s)) return { ok: false, reason: "reserved" };

  // Single scan character validity + consecutive '--' check
  // Allowed: a-z (97-122), A-Z (65-90), 0-9 (48-57), '-' (45)
  // 单次扫描校验字符合法性 + 检查连续 '--'
  // 允许：a-z (97-122)、A-Z (65-90)、0-9 (48-57)、'-' (45)
  let prevHyphen = false;
  for (let i = 0; i < len; i++) {
    const c = s.charCodeAt(i);

    if (c === 45) {
      // '-' — '-'
      if (prevHyphen) return { ok: false, reason: "double_hyphen" };
      prevHyphen = true;
      continue;
    }
    prevHyphen = false;

    // 0-9
    // 0-9
    if (c >= 48 && c <= 57) continue;
    // a-z
    // a-z
    if (c >= 97 && c <= 122) continue;
    // A-Z
    // A-Z
    if (c >= 65 && c <= 90) continue;

    return { ok: false, reason: "invalid_char" };
  }

  return { ok: true, normalized: s };
}
