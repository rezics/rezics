import React from 'react';

export type HomePromotionStripProps = {
  items?: {text: string; href?: string}[];
};

/**
 * HomePromotionStrip
 * A simple horizontal strip for announcements/promotions.
 */
export const HomePromotionStrip: React.FC<HomePromotionStripProps> = ({
  items = [
    {text: '平台公告：本周新版本已发布'},
    {text: '书展活动：秋季读书节'},
    {text: '限时优惠：精选书单 8 折'},
  ],
}) => {
  return (
    <div className="w-full bg-purple-50 border border-purple-100 rounded px-4 py-2 overflow-x-auto">
      <div className="flex gap-6 whitespace-nowrap text-sm">
        {items.map((item, i) => (
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
