import {HomeSearchBar} from '../section/HomeSearchBar';
import {HomeQuickAccessLinks} from '../section/HomeQuickAccessLinks';
import {HomeMeiliDiscoverySection} from '../section/meiliDiscovery/HomeMeiliDiscoverySection';
import {MobileHomeHeader} from '../section/Mobile/MobileHomeHeader';
import {MobileHomeCarousel} from '../section/Mobile/MobileHomeCarousel';
import {MobileHomeDiscovery} from '../section/Mobile/MobileHomeDiscovery';
import React from 'react';
import {useIsMobile} from '@/shared/util/use-media-query';
import {useTranslation} from 'react-i18next';
import {NewBookSection} from '../section/NewBookSection';
import {BookCarousel} from '../component/HomeCarousel';
import {Paper} from '@mui/material';
import {AnnouncementBarSection} from '../section/AnnouncementBar';

export type HomeShowProps = object;

export const HomeShow: React.FC<HomeShowProps> = () => {
  const {t} = useTranslation();

  return (
    <div className="w-10/12 mx-auto mb-10">
      <section>
        <Paper sx={{p: 2, mt: 2}}>
          <div className="w-full">
            <div className="space-y-2 mb-4">
              <p className="text-[10px] uppercase tracking-[0.35em] text-primary/80">
                {t('page.home.hero.kicker')}
              </p>
              <h1 className="text-2xl font-semibold leading-snug">
                <span className="text-primary">
                  {' '}
                  {t('page.home.hero.title_highlight')}
                </span>
              </h1>
              <p className="text-xs text-muted-foreground">
                {t('page.home.hero.subtitle')}
              </p>
            </div>
            <BookCarousel autoplayIntervalNum={3000} />
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
        </Paper>
      </section>

      <Paper sx={{mt: 2}}>
        <AnnouncementBarSection />
      </Paper>

      {/* Discovery section powered by Meilisearch */}
      <Paper sx={{p: 2, mt: 2}}>
        <NewBookSection />
      </Paper>

      <section>
        <Paper sx={{p: 2, mt: 2}}>
          <HomeMeiliDiscoverySection />
        </Paper>
      </section>
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
