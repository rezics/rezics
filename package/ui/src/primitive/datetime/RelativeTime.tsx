import { useTranslation } from "@rezics/i18n/react";
import type React from "react";
import { useEffect, useState } from "react";
import {
  type RelativeTimeInput,
  relativeTimeFromNow,
} from "./relativeTimeFromNow";

export type RelativeTimeProps = {
  /** Timestamp to display relative to now. 相对当前显示的时间。 */
  value: RelativeTimeInput;
  /**
   * Re-render cadence in ms to keep recent times fresh; 0 disables ticking.
   * 刷新节拍（ms），让新近时间保持鲜活；0 关闭自动刷新。
   */
  liveMs?: number;
  className?: string;
};

/**
 * Render a localized, auto-refreshing relative timestamp as a semantic `<time>`
 * element, with the absolute date exposed in the tooltip/`title`. This is the
 * one component every surface uses to show "x ago", so thresholds, wording, and
 * locale behavior stay identical across notifications, cards, profiles, etc.
 * 以语义 <time> 渲染本地化、自动刷新的相对时间，并在 tooltip/title 暴露绝对时间。
 * 全站凡显示「x 前」皆用它，于是通知、卡片、资料页等处的阈值、措辞与语言行为完全一致。
 */
export const RelativeTime: React.FC<RelativeTimeProps> = ({
  value,
  liveMs = 60_000,
  className,
}) => {
  const { i18n } = useTranslation();
  const [, tick] = useState(0);

  useEffect(() => {
    if (!liveMs) return;
    const id = setInterval(() => tick((n) => n + 1), liveMs);
    return () => clearInterval(id);
  }, [liveMs]);

  const parts = relativeTimeFromNow(value, { locale: i18n.language });
  if (!parts) return null;

  return (
    <time dateTime={parts.iso} title={parts.absolute} className={className}>
      {parts.relative}
    </time>
  );
};
