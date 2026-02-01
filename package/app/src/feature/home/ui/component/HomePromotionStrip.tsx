import React from 'react';
import {useTranslation} from 'react-i18next';

export type HomePromotionStripProps = {
  items?: {text: string; href?: string}[];
};

/**
 * HomePromotionStrip
 * A simple horizontal strip for announcements/promotions.
 */
export const HomePromotionStrip: React.FC<HomePromotionStripProps> = ({
  items,
}) => {
  const {t} = useTranslation();
  const resolvedItems = items ?? [
    {text: t('page.home.sections.promotion_item_1')},
    {text: t('page.home.sections.promotion_item_2')},
    {text: t('page.home.sections.promotion_item_3')},
  ];

  return (
    <div className="w-full bg-purple-50 border border-purple-100 rounded px-4 py-2 overflow-x-auto">
      <div className="flex gap-6 whitespace-nowrap text-sm">
        {resolvedItems.map((item, i) => (
          <a
            key={i}
            href={item.href || '#'}
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
