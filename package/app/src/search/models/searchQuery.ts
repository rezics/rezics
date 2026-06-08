import type {
  AiDisclosureMode,
  ContentRating,
  PostKind,
  SearchQuery,
} from "@rezics/contract";
import { normalizeLanguage } from "@rezics/contract";

const KIND_TOKENS: Record<string, PostKind> = {
  review: "REVIEW",
  reviews: "REVIEW",
  excerpt: "EXCERPT",
  excerpts: "EXCERPT",
  remark: "REMARK",
  remarks: "REMARK",
  post: "POST",
  posts: "POST",
  chapter: "CHAPTER",
  chapters: "CHAPTER",
  wiki: "WIKI",
  wikis: "WIKI",
};

const RATING_TOKENS: Record<string, ContentRating> = {
  general: "GENERAL",
  g: "GENERAL",
  r15: "R_15",
  r_15: "R_15",
  "r-15": "R_15",
  r18: "R_18",
  r_18: "R_18",
  "r-18": "R_18",
  r18g: "R_18G",
  r_18g: "R_18G",
  "r-18g": "R_18G",
};

const AI_DISCLOSURE_TOKENS: Record<string, AiDisclosureMode> = {
  unknown: "UNKNOWN",
  none: "NONE",
  no_ai: "NONE",
  "no-ai": "NONE",
  assisted: "AI_ASSISTED",
  ai_assisted: "AI_ASSISTED",
  "ai-assisted": "AI_ASSISTED",
  originated: "AI_ORIGINATED",
  ai_originated: "AI_ORIGINATED",
  "ai-originated": "AI_ORIGINATED",
  machine: "MACHINE_GENERATED",
  machine_generated: "MACHINE_GENERATED",
  "machine-generated": "MACHINE_GENERATED",
};

const TAG_REGEX = /\[([^\]]+)\]/g;
const FILTER_REGEX = /(\w+):("[^"]*"|\S+)/g;

/**
 * Parse a StackOverflow-style search string into a structured SearchQuery.
 * 将 StackOverflow 风格的搜索字符串解析为结构化的 SearchQuery。
 *
 * Supported tokens:
 * 支持的 token：
 *   [slug]          → tag filter。标签过滤
 *   type:value      → content type。内容类型
 *   lang:value      → language。语言
 *   rating:tier     → rating tier (GENERAL, R_15, R_18, R_18G; repeatable)。分级（可重复）
 *   platform:id     → game platform Entity id (repeatable)。游戏平台 Entity id（可重复）
 *   ageRating:id    → external rating tag Unit id (repeatable)。外部分级标签 Unit id（可重复）
 *   ai:value        → AI disclosure mode (UNKNOWN, NONE, AI_ASSISTED, AI_ORIGINATED, MACHINE_GENERATED; repeatable)。AI 披露模式（可重复）
 *   licensed:yes|no → licensed toggle。授权开关
 *   in:slug         → realm scope。realm 范围
 *   sort:value      → sort order。排序方式
 *   kind:value      → post kind (review/excerpt/remark/post/chapter/wiki; last-wins)。帖子类型（后者覆盖前者）
 *   everything else → keyword。其余皆为关键词
 */
export function parseSearchString(input: string): SearchQuery {
  if (!input.trim()) return {};

  const result: SearchQuery = {};
  let remaining = input;

  // Extract [tag] tokens
  // 提取 [tag] token
  const tagMatches = [...input.matchAll(TAG_REGEX)];
  if (tagMatches.length > 0) {
    result.tags = tagMatches
      .map((m) => m[1]!)
      .filter(Boolean)
      .map((slug) => ({ slug }));
    for (const m of tagMatches) {
      remaining = remaining.replace(m[0], "");
    }
  }

  // Extract key:value tokens
  // 提取 key:value token
  const filterMatches = [...remaining.matchAll(FILTER_REGEX)];
  for (const m of filterMatches) {
    const key = m[1]!.toLowerCase();
    const rawValue = m[2]!.replace(/^"|"$/g, "");

    switch (key) {
      case "type":
        result.type = [...(result.type ?? []), rawValue];
        break;
      case "lang":
        {
          const language = normalizeLanguage(rawValue);
          if (language) {
            result.languages = [...(result.languages ?? []), language];
          }
        }
        break;
      case "rating": {
        const tier = RATING_TOKENS[rawValue.toLowerCase()];
        if (tier) {
          result.ratings = [...(result.ratings ?? []), tier];
        }
        break;
      }
      case "platform":
      case "platformentity": {
        result.platformEntityIds = [
          ...(result.platformEntityIds ?? []),
          rawValue,
        ];
        break;
      }
      case "agerating":
      case "ratingtag": {
        result.ageRatingTagUnitIds = [
          ...(result.ageRatingTagUnitIds ?? []),
          rawValue,
        ];
        break;
      }
      case "ai":
      case "aidisclosure": {
        const mode = AI_DISCLOSURE_TOKENS[rawValue.toLowerCase()];
        if (mode) {
          result.aiDisclosureModes = [
            ...(result.aiDisclosureModes ?? []),
            mode,
          ];
        }
        break;
      }
      case "licensed":
        result.isLicensed = rawValue === "yes" || rawValue === "true";
        break;
      case "in":
        result.realm = { scope: "realm", slug: rawValue };
        break;
      case "sort":
        result.sort = rawValue;
        break;
      case "kind": {
        const kind = KIND_TOKENS[rawValue.toLowerCase()];
        if (kind) {
          // Single-valued, last-wins. Unknown values are silently dropped.
          // 单值，后者覆盖前者。未知值会被静默丢弃。
          result.kind = kind;
        }
        break;
      }
    }

    remaining = remaining.replace(m[0], "");
  }

  // Remaining text is the keyword
  // 剩余文本即为关键词
  const keyword = remaining.trim();
  if (keyword) {
    result.keyword = keyword;
  }

  return result;
}

/**
 * Serialize a structured SearchQuery back into the SO-style syntax string.
 * 将结构化的 SearchQuery 序列化回 SO 风格的语法字符串。
 */
export function serializeSearchString(query: SearchQuery): string {
  const parts: string[] = [];

  if (query.tags?.length) {
    for (const tag of query.tags) {
      parts.push(`[${tag.slug}]`);
    }
  }

  if (query.type?.length) {
    for (const t of query.type) {
      parts.push(`type:${t}`);
    }
  }

  if (query.languages?.length) {
    for (const lang of query.languages) {
      parts.push(`lang:${lang}`);
    }
  }

  if (query.ratings?.length) {
    for (const tier of query.ratings) {
      parts.push(`rating:${tier}`);
    }
  }

  if (query.platformEntityIds?.length) {
    for (const id of query.platformEntityIds) {
      parts.push(`platform:${id}`);
    }
  }

  if (query.ageRatingTagUnitIds?.length) {
    for (const id of query.ageRatingTagUnitIds) {
      parts.push(`ageRating:${id}`);
    }
  }

  if (query.aiDisclosureModes?.length) {
    for (const mode of query.aiDisclosureModes) {
      parts.push(`ai:${mode}`);
    }
  }

  if (query.isLicensed !== undefined) {
    parts.push(`licensed:${query.isLicensed ? "yes" : "no"}`);
  }

  if (query.realm) {
    parts.push(`in:${query.realm.slug}`);
  }

  if (query.sort) {
    parts.push(`sort:${query.sort}`);
  }

  if (query.kind) {
    parts.push(`kind:${query.kind}`);
  }

  if (query.keyword) {
    parts.push(query.keyword);
  }

  return parts.join(" ");
}
