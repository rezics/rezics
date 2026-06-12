import { useTranslation } from "@rezics/i18n/react";

/**
 * Placeholder media library home page.
 * 媒体库主页占位符。
 *
 * Displays a simple title for the media library section.
 * 为媒体库部分显示简单标题。
 *
 * Desktop (md+):
 * ┌────────────────────────────────────┐
 * │ Media Library                      │
 * │                                    │
 * │ [Grid of media cards/items]        │
 * │ [Video/Movie cards with thumbs]    │
 * │ [Metadata: Duration, Year, etc]    │
 * └────────────────────────────────────┘
 *
 * Tablet (sm-md):
 * ┌──────────────────────┐
 * │ Media Library        │
 * │ [Media grid]         │
 * │ (2-3 cols)           │
 * └──────────────────────┘
 *
 * Mobile (xs-sm):
 * ┌────────────────┐
 * │ Media Library  │
 * │ [Card 1]       │
 * │ [Card 2]       │
 * │ [Card 3]       │
 * │ (1 col stack)  │
 * └────────────────┘
 *
 * Empty state:
 * ┌────────────────────────────────────┐
 * │ Media Library                      │
 * │                                    │
 * │ No media available yet             │
 * │ [Explore Other Libraries]          │
 * └────────────────────────────────────┘
 */
export const MediaHomePage: React.FC = () => {
  const { t } = useTranslation(["shell"]);
  return <div>{t("shell:media_library_title")}</div>;
};
