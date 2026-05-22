import { useEffect, useRef, useState } from "react";
import { BookCarousel } from "../components/HomeCarousel";
import { NoticeBoard } from "./NoticeBoard";
import * as m from "@rezics/i18n/messages";

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
        noticeRef.current.style.height = isWide ? `${h}px` : "auto";
      }
    };

    const ro = new ResizeObserver(updateLayout);
    if (carouselRef.current) ro.observe(carouselRef.current);
    window.addEventListener("resize", updateLayout);
    updateLayout();

    return () => {
      window.removeEventListener("resize", updateLayout);
      ro.disconnect();
    };
  }, [isWide]);

  return (
    <div
      ref={containerRef}
      className={`q-pa-md flex gap-4 transition-all duration-300 ${
        isWide ? "flex-row items-start" : "flex-col"
      }`}
    >
      {/* 左侧：BookCarousel */}
      <div ref={carouselRef} className={`${isWide ? "w-2/3" : "w-full"}`}>
        <div className="space-y-2 mb-4">
          <p className="text-[10px] uppercase tracking-[0.35em] text-primary/80">
            {m.page_home_hero_kicker()}
          </p>
          <h1 className="text-2xl font-semibold leading-snug">
            <span className="text-primary">
              {" "}
              {m.page_home_hero_title_highlight()}
            </span>
          </h1>
          <p className="text-xs text-muted-foreground">
            {m.page_home_hero_subtitle()}
          </p>
        </div>
        <BookCarousel autoplayIntervalNum={3000} />
      </div>

      {/* 右侧：NoticeBoard */}
      <div
        ref={noticeRef}
        className={`${isWide ? "w-1/3" : "w-full"} overflow-auto max-h-[32rem]`}
      >
        <NoticeBoard />
      </div>
    </div>
  );
}
