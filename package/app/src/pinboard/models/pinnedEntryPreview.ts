import type { PinboardEntryView } from "./types";

export type PinboardPinnedPreview =
  | {
      mode: "image";
      imageUrl: string;
    }
  | {
      mode: "text";
      text?: string;
    };

/**
 * Resolve the mutually exclusive preview mode for a public pinned card.
 * Image previews are visual-first and only render the title; text previews use
 * the richest available short body text.
 * 解析公开置顶卡片的互斥预览模式。图片预览以视觉为主，只渲染标题；
 * 文本预览则使用最合适的短正文。
 */
export function resolvePinboardPinnedPreview(
  entry: Pick<
    PinboardEntryView,
    "description" | "imageUrl" | "subtitle" | "summary"
  >,
): PinboardPinnedPreview {
  const imageUrl = cleanText(entry.imageUrl);
  if (imageUrl) return { mode: "image", imageUrl };

  return {
    mode: "text",
    text:
      cleanText(entry.summary) ??
      cleanText(entry.description) ??
      cleanText(entry.subtitle),
  };
}

function cleanText(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
