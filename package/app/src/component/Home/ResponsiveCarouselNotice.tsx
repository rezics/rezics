import {BookCarousel} from '@component/Home/HomeCarousel';
import {NoticeBoard} from '@component/Home/NoticeBoard';

import {useEffect, useRef, useState} from 'react';

export function ResponsiveCarouselNotice() {
  const containerRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const [isWide, setIsWide] = useState(window.innerWidth >= 1200);

  // 同步高度和宽度布局模式
  useEffect(() => {
    const updateLayout = () => {
      const w = window.innerWidth;
      setIsWide(w >= 1200);

      // 同步高度
      if (carouselRef.current && noticeRef.current) {
        const h = carouselRef.current.getBoundingClientRect().height;
        noticeRef.current.style.height = isWide ? `${h}px` : 'auto';
      }
    };

    const ro = new ResizeObserver(updateLayout);
    if (carouselRef.current) ro.observe(carouselRef.current);
    window.addEventListener('resize', updateLayout);
    updateLayout();

    return () => {
      window.removeEventListener('resize', updateLayout);
      ro.disconnect();
    };
  }, [isWide]);

  return (
    <div
      ref={containerRef}
      className={`q-pa-md flex gap-4 transition-all duration-300 ${
        isWide ? 'flex-row items-start' : 'flex-col'
      }`}
    >
      {/* 左侧：BookCarousel */}
      <div ref={carouselRef} className={`p-4 ${isWide ? 'w-2/3' : 'w-full'}`}>
        <BookCarousel autoplayIntervalNum={3000} />
      </div>

      {/* 右侧：NoticeBoard */}
      <div
        ref={noticeRef}
        className={`${isWide ? 'w-1/3' : 'w-full'} overflow-auto max-h-[32rem]`}
      >
        <NoticeBoard />
      </div>
    </div>
  );
}
