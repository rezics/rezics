import { readFileSync, writeFileSync } from "node:fs";

const additions: Record<string, { en: string; zh: string }> = {
  notification_kind_reaction_like: { en: "liked", zh: "讚了" },
  notification_kind_reaction_favorite: { en: "favorited", zh: "收藏了" },
  notification_kind_follow: { en: "followed you", zh: "追蹤了你" },
  notification_kind_reply: { en: "commented", zh: "回覆了" },
  notification_kind_mention: { en: "mentioned you", zh: "提及了你" },
  notification_kind_realm_invite: { en: "invited you", zh: "邀請了你" },
  notification_kind_system: { en: "system", zh: "系統通知" },
  notification_actor_fallback: { en: "Someone", zh: "有人" },
  notification_unread: { en: "Unread", zh: "未讀" },
  notification_time_now: { en: "just now", zh: "剛剛" },
  notification_time_minutes: { en: "{{value}}m", zh: "{{value}} 分鐘" },
  notification_time_hours: { en: "{{value}}h", zh: "{{value}} 小時" },
  notification_time_days: { en: "{{value}}d", zh: "{{value}} 天" },
};

function patch(path: string, lang: "en" | "zh") {
  const obj = JSON.parse(readFileSync(path, "utf8")) as Record<string, string>;
  let added = 0;
  for (const [k, v] of Object.entries(additions)) {
    if (!(k in obj)) {
      obj[k] = v[lang];
      added++;
    }
  }
  writeFileSync(path, `${JSON.stringify(obj, null, 2)}\n`, "utf8");
  console.log(`${path}: +${added} keys`);
}

patch("packages/i18n/locales/en/community.json", "en");
patch("packages/i18n/locales/zh-hant/community.json", "zh");
