import React from 'react';
import {LockedPanel} from './components/LockedPanel';
import {BooksSection} from './sections/BooksSection';
import {ReadlistsSection} from './sections/ReadlistsSection';
import {ReviewsSection} from './sections/ReviewsSection';
import {QuotesSection} from './sections/QuotesSection';

export type HomeMeiliDiscoverySectionProps = {
  bookLimit?: number;
  readlistLimit?: number;
  reviewLimit?: number;
  quoteLimit?: number;
};

/**
 * HomeMeiliDiscoverySection
 * - 基于 Meilisearch 的统一发现区：
 *   - Book list
 *   - Readlist list
 *   - Review list
 *   - Quote list
 * - 布局全部使用 Tailwind，视觉样式继承 MUI 组件
 */
export const HomeMeiliDiscoverySection: React.FC<HomeMeiliDiscoverySectionProps> =
  ({bookLimit = 50, readlistLimit = 6, reviewLimit = 6, quoteLimit = 6}) => {
    return (
      <div className="mt-8 space-y-6">
        {/* 第一行：为你推荐 + 精选书单 */}
        {/* 使用 lg:h-[42rem] 这样的固定高度值来“锁死”布局 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <LockedPanel>
              {/* 增加 limit 以利用滚动空间 */}
              <BooksSection limit={bookLimit} />
            </LockedPanel>
          </div>
          <div className="lg:col-span-1">
            <LockedPanel>
              <ReadlistsSection limit={readlistLimit || 8} />
            </LockedPanel>
          </div>
        </div>

        {/* 第二行：高赞短评 + 金句摘录 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <LockedPanel>
              <ReviewsSection limit={reviewLimit || 8} />
            </LockedPanel>
          </div>
          <div className="lg:col-span-1">
            <LockedPanel>
              <QuotesSection limit={quoteLimit || 8} />
            </LockedPanel>
          </div>
        </div>
      </div>
    );
  };

export default HomeMeiliDiscoverySection;

