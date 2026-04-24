import type { PrismaClient } from "#/prisma/generated/client.js";
import { pinboardService } from "@/pinboard/pinboard.service";

/**
 * Seed sample announcements on the default realm so the homepage bar
 * renders non-empty after a fresh reset. Mix of single- and multilingual
 * entries exercises both the standalone and TranslationGroup paths.
 */
export async function seedPinboardSamples(
  _prisma: PrismaClient,
  defaultRealmId: string,
  rootUserId: string,
): Promise<void> {
  console.log("[Seed] Seeding pinboard announcement samples...");

  // Trilingual entry: zh-hans + en + ja.
  await pinboardService.createEntry(
    defaultRealmId,
    "announcement",
    {
      defaultLanguage: "zh-hans",
      translations: [
        {
          language: "zh-hans",
          title: "欢迎来到 Rezics",
          summary: "一个关于书籍、游戏与多媒体的开放讨论社区。",
          body: "# 欢迎\n\n我们正在构建一个面向所有内容形式的开放评论与讨论平台。",
        },
        {
          language: "en",
          title: "Welcome to Rezics",
          summary: "An open community for books, games, and media discussion.",
          body: "# Welcome\n\nWe're building an open review and discussion platform for all content formats.",
        },
        {
          language: "ja",
          title: "Rezicsへようこそ",
          summary: "本、ゲーム、メディアを語るオープンなコミュニティ。",
          body: "# ようこそ\n\nあらゆる作品のレビューと議論のためのオープンな場を構築しています。",
        },
      ],
    },
    rootUserId,
  );

  // Single-language zh-hans entry.
  await pinboardService.createEntry(
    defaultRealmId,
    "announcement",
    {
      defaultLanguage: "zh-hans",
      translations: [
        {
          language: "zh-hans",
          title: "每周社区摘要",
          summary: "本周站点动态与社区亮点。",
          body: "# 每周摘要\n\n- 新上线功能预告\n- 本周热门讨论\n- 官方活动预告",
        },
      ],
    },
    rootUserId,
  );

  // Dual-language en + zh-hans, with English as default.
  await pinboardService.createEntry(
    defaultRealmId,
    "announcement",
    {
      defaultLanguage: "en",
      translations: [
        {
          language: "en",
          title: "Community Guidelines Updated",
          summary: "Refreshed to reflect the new content rating system.",
          body: "# Guidelines Updated\n\nRead the new content rating rules before posting.",
        },
        {
          language: "zh-hans",
          title: "社区指南已更新",
          summary: "与新的内容分级系统同步更新。",
          body: "# 指南已更新\n\n发帖前请阅读新的内容分级规则。",
        },
      ],
    },
    rootUserId,
  );
}
