import {HomeSearchBar} from '@component/Home/HomeSearchBar';
import {HomeQuickAccessLinks} from '@component/Home/HomeQuickAccessLinks';
import {ResponsiveCarouselNotice} from '@component/Home/ResponsiveCarouselNotice';
import {HomeMeiliDiscoverySection} from '@component/Home/HomeMeiliDiscoverySection';
import React from 'react';

export type HomeShowProps = object;

export const HomeShow: React.FC<HomeShowProps> = () => {
  return (
    <div className="w-10/12 mx-auto mb-10">
      {/* First Carousel */}
      <div className="mt-6">{/* <ResponsiveCarouselNotice /> */}</div>
      {/* End First Carousel */}

      {/* Promotion strip */}

      {/* Search and quick links */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="lg:col-span-1">
          <HomeSearchBar />
        </div>
        <div className="lg:col-span-1">
          <HomeQuickAccessLinks />
        </div>
      </div>

      {/* End New Releases Section */}
      {/* Ranking + Tags */}

      {/* Discovery section powered by Meilisearch */}
      <HomeMeiliDiscoverySection />
      {/* Author spotlight */}
      {/* <div className="mt-10">
        <HomeAuthorSpotlight />
      </div> */}

      {/* Partner brands */}
      {/* CTA + Newsletter */}
      {/* 干脆写个插件化定制板块的首页。 */}
    </div>
  );
};

export type HomeContainerProps = object;

export const HomeContainer: React.FC<HomeContainerProps> = () => {
  return <HomeShow />;
};
