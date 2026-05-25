import type React from "react";
import { useMessage } from "@rezics/i18n/react";
import {
  page_home_sections_promotion_item_1,
  page_home_sections_promotion_item_2,
  page_home_sections_promotion_item_3,
} from "@rezics/i18n/messages";
const i18nMessages = {
  page_home_sections_promotion_item_1,
  page_home_sections_promotion_item_2,
  page_home_sections_promotion_item_3,
};

export type HomePromotionStripProps = {
  items?: { text: string; href?: string }[];
};

/**
 * HomePromotionStrip
 * A simple horizontal strip for announcements/promotions.
 */
export const HomePromotionStrip: React.FC<HomePromotionStripProps> = ({
  items,
}) => {
  const m = useMessage(i18nMessages);
  const resolvedItems = items ?? [
    { text: m.page_home_sections_promotion_item_1() },
    { text: m.page_home_sections_promotion_item_2() },
    { text: m.page_home_sections_promotion_item_3() },
  ];

  return (
    <div className="w-full bg-purple-50 border border-purple-100 rounded px-4 py-2 overflow-x-auto">
      <div className="flex gap-8 whitespace-nowrap text-sm">
        {resolvedItems.map((item, i) => (
          <a
            // biome-ignore lint/suspicious/noArrayIndexKey: static list
            key={i}
            href={item.href || "#"}
            className="text-purple-700 hover:underline"
          >
            {item.text}
          </a>
        ))}
      </div>
    </div>
  );
};

export default HomePromotionStrip;
