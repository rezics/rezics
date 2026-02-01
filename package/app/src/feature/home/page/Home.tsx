import {HomeSearchBar} from '../ui/section/HomeSearchBar';
import {HomeQuickAccessLinks} from '../ui/section/HomeQuickAccessLinks';
import {ResponsiveCarouselNotice} from '../ui/section/ResponsiveCarouselNotice';
import {HomeMeiliDiscoverySection} from '../ui/section/meiliDiscovery/HomeMeiliDiscoverySection';
import {MobileHomeHeader} from '../ui/section/Mobile/MobileHomeHeader';
import {MobileHomeCarousel} from '../ui/section/Mobile/MobileHomeCarousel';
import {MobileHomeDiscovery} from '../ui/section/Mobile/MobileHomeDiscovery';
import React from 'react';
import {useIsMobile} from '@/util/useMediaQueryUtil';
import {useTranslation} from 'react-i18next';

export type HomeShowProps = object;

export const HomeShow: React.FC<HomeShowProps> = () => {
  return (
    <div className="w-10/12 mx-auto mb-10">
      <section className="px-4 pt-4 pb-6 space-y-4 bg-background text-foreground rounded-lg">
        {/* First Carousel */}
        <div className="mt-2">
          <ResponsiveCarouselNotice />
        </div>

        {/* Search and quick links */}
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="lg:col-span-1">
            <HomeSearchBar />
          </div>
          <div className="lg:col-span-1">
            <HomeQuickAccessLinks />
          </div>
        </div>
      </section>

      {/* Discovery section powered by Meilisearch */}
      <div className="mt-8">
        <HomeMeiliDiscoverySection />
      </div>
    </div>
  );
};

/**
 * HomeShowMobile
 */
const HomeShowMobile: React.FC = () => {
  const {t} = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* 顶部 Banner：轮播 */}
      <MobileHomeCarousel />

      <section className="pb-6">
        {/* 顶部：品牌 + Hero + 搜索 */}
        <MobileHomeHeader />
      </section>

      {/* 发现区：Meilisearch 驱动的推荐内容 */}
      <section className="px-3">
        <MobileHomeDiscovery />
      </section>

      {/* 底部浮动导航/状态条 */}
      {/* TODO 后续可能据此风格制作可选开关的Bottom Navigation */}
      <div className="fixed bottom-3 inset-x-0 px-4 z-30 pointer-events-none hidden">
        <div className="mx-auto max-w-md rounded-full bg-background/95 border border-border shadow-lg px-4 py-2 flex items-center justify-between text-[11px] text-muted-foreground backdrop-blur-sm pointer-events-auto">
          <span className="font-medium">
            {t('page.home.mobile.floating_status.browsing_recommendations')}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            {t('page.home.mobile.floating_status.beta_experimental')}
          </span>
        </div>
      </div>
    </div>
  );
};

export type HomeContainerProps = object;

export const HomeContainer: React.FC<HomeContainerProps> = () => {
  const isMobile = useIsMobile();

  // 使用 media query 区分两套完全不同的首页布局
  if (isMobile) {
    return <HomeShowMobile />;
  }
  return <HomeShow />;
};
