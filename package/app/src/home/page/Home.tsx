import {HomeQuickAccessLinks} from '../section/HomeQuickAccessLinks';
import React from 'react';
import {useTranslation} from 'react-i18next';
import {NewBookSection} from '../section/NewBookSection';
import {BookCarousel} from '../component/HomeCarousel';
import {Paper} from '@mui/material';
import {AnnouncementBarSection} from '../section/AnnouncementBarSection';
import {useIsMobile} from '@/shared/util/use-media-query';
import {cn} from '@/shared/util/css-util';
import {TrendingBookSection} from '../section/TrendingBookSection';
import {TrendingReviews} from '../section/TrendingReviewsSection';
import {TrendingReadListSection} from '../section/TrendingReadListSection';

export type HomeProps = object;

export const Home: React.FC<HomeProps> = () => {
  const {t} = useTranslation();
  const isMobile = useIsMobile();

  return (
    <div className={cn('mx-auto mb-10', isMobile ? 'w-full' : 'w-10/12')}>
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
          <div className="mt-6">
            <HomeQuickAccessLinks />
          </div>
        </Paper>
      </section>

      <Paper sx={{mt: 2}}>
        <AnnouncementBarSection />
      </Paper>

      <Paper sx={{mt: 2, p: 2}}>
        <TrendingReadListSection />
      </Paper>

      <Paper sx={{mt: 2, p: 2}}>
        <TrendingReviews />
      </Paper>

      <Paper sx={{mt: 2, p: 2}}>
        <NewBookSection />
      </Paper>

      {/* 添加引用区块 */}

      <Paper sx={{mt: 2, p: 2}}>
        <TrendingBookSection />
      </Paper>

      {/* 添加评论区块 */}
    </div>
  );
};
