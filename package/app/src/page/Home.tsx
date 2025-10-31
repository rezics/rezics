import {BookCarousel} from '@component/Home/HomeCarousel';
import {HomeNewReleases} from '@component/Home/HomeNewReleases';
import {HomeRankingSection} from '@component/Home/HomeRankingSection';
import {HomeTagExplore} from '@component/Home/HomeTagExplore';
import {HomeEditorPicks} from '@component/Home/HomeEditorPicks';
import {HomeReadList} from '@component/Home/HomeReadList';
import {HomeSearchBar} from '@component/Home/HomeSearchBar';
import {HomeQuickAccessLinks} from '@component/Home/HomeQuickAccessLinks';
import {HomeMobileDownloadCTA} from '@component/Home/HomeMobileDownloadCTA';
import {HomeNewsletterSignup} from '@component/Home/HomeNewsletterSignup';
import {HomePartnerBrands} from '@component/Home/HomePartnerBrands';
import {HomePromotionStrip} from '@component/Home/HomePromotionStrip';
import {HomeTrendingReviews} from '@component/Home/HomeTrendingReviews';
import {HomeTrendingWiki} from '@component/Home/HomeTrendingWiki';
import {HomeAuthorSpotlight} from '@component/Home/HomeAuthorSpotlight';
import {useTranslation} from 'react-i18next';
import React from 'react';

export type HomeShowProps = object;

export const HomeShow: React.FC<HomeShowProps> = () => {
  const {t} = useTranslation();
  return (
    <div className="w-10/12 mx-auto">
      {/* First Carousel */}
      <div className="q-pa-md flex space-x-4">
        <div className="text-purple w-2/3 p-4 flex-none">
          <BookCarousel autoplayIntervalNum={3000} />
        </div>
        <div className="w-1/3 bg-green-200 p-4 flex-1">右侧公告板</div>
      </div>
      {/* End First Carousel */}
      {/* Promotion strip */}
      <div className="mt-6">
        <HomePromotionStrip />
      </div>
      {/* Search and quick links */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2">
          <HomeSearchBar />
        </div>
        <div>
          <HomeQuickAccessLinks />
        </div>
      </div>
      {/* New Releases Section */}
      <div className="mt-8">
        <HomeNewReleases />
      </div>
      {/* End New Releases Section */}
      {/* Ranking + Tags */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <HomeEditorPicks />
        </div>
        <div className="space-y-6">
          <HomeRankingSection />
          <HomeTagExplore />
        </div>
      </div>
      {/* Read list */}
      <div className="mt-8">
        <HomeReadList />
      </div>
      {/* Trending content */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <HomeTrendingReviews />
        <HomeTrendingWiki />
      </div>
      {/* Author spotlight */}
      <div className="mt-8">
        <HomeAuthorSpotlight />
      </div>
      {/* Partner brands */}
      <div className="mt-8">
        <HomePartnerBrands />
      </div>
      {/* CTA + Newsletter */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <HomeMobileDownloadCTA />
        <HomeNewsletterSignup />
      </div>
      {/* 干脆写个插件化定制板块的首页。 */}
      <div>
        <p>{t('title')}</p>、<p>{t('accessibility.comments')}</p>
        <p>{t('auth.error.invalid_username')}</p>
      </div>
    </div>
  );
};

export type HomeContainerProps = object;

export const HomeContainer: React.FC<HomeContainerProps> = () => {
  return <HomeShow />;
};
