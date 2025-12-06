import React from 'react';
import {LazyLoadImage} from '../Common/LazyLoadImage';

const defaultBrands = [
  'https://dummyimage.com/100x40/cccccc/000&text=Brand+A',
  'https://dummyimage.com/100x40/cccccc/000&text=Brand+B',
  'https://dummyimage.com/100x40/cccccc/000&text=Brand+C',
  'https://dummyimage.com/100x40/cccccc/000&text=Brand+D',
  'https://dummyimage.com/100x40/cccccc/000&text=Brand+E',
];

export type HomePartnerBrandsProps = {
  logos?: string[];
  title?: string;
};

export const HomePartnerBrands: React.FC<HomePartnerBrandsProps> = ({
  logos = defaultBrands,
  title = '合作伙伴',
}) => {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold">{title}</span>
      </div>
      <div className="flex flex-wrap gap-6 items-center">
        {logos.map((src, i) => (
          <LazyLoadImage
            key={i}
            src={src}
            alt={`brand-${i}`}
            className="h-10 object-contain"
          />
        ))}
      </div>
    </div>
  );
};

export default HomePartnerBrands;
