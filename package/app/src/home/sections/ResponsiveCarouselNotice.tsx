import { useTranslation } from "@rezics/i18n/react";
import { useEffect, useRef, useState } from "react";
import { BookCarousel } from "../components/HomeCarousel";
import { NoticeBoard } from "./NoticeBoard";

export function ResponsiveCarouselNotice() {
  const { t } = useTranslation(["page"]);
  const containerRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const [isWide, setIsWide] = useState(window.innerWidth >= 1200);

  // Sync height and the wide/narrow layout mode.
  // 同步高度和宽度布局模式
  useEffect(() => {
    const updateLayout = () => {
      const w = window.innerWidth;
      setIsWide(w >= 1200);

      // Sync height.
      // 同步高度
      if (carouselRef.current && noticeRef.current) {
        const h = carouselRef.current.getBoundingClientRect().height;
        // Derive layout mode from current width to avoid stale closure over isWide.
        // 从当前宽度推导布局模式，避免闭包捕获到过期的 isWide。
        noticeRef.current.style.height = w >= 1200 ? `${h}px` : "auto";
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
  }, []);

  return (
    <div
      ref={containerRef}
      className={`q-pa-md flex gap-4 transition-all duration-300 ${
        isWide ? "flex-row items-start" : "flex-col"
      }`}
    >
      {/* Left: BookCarousel — 左侧：BookCarousel */}
      <div ref={carouselRef} className={`${isWide ? "w-2/3" : "w-full"}`}>
        <div className="space-y-2 mb-4">
          <p className="text-[10px] uppercase tracking-[0.35em] text-primary/80">
            {t("page:home_hero_kicker")}
          </p>
          <h1 className="text-2xl font-semibold leading-snug">
            <span className="text-primary">
              {" "}
              {t("page:home_hero_title_highlight")}
            </span>
          </h1>
          <p className="text-xs text-muted-foreground">
            {t("page:home_hero_subtitle")}
          </p>
        </div>
        <BookCarousel autoplayIntervalNum={3000} />
      </div>

      {/* Right: NoticeBoard — 右侧：NoticeBoard */}
      <div
        ref={noticeRef}
        className={`${isWide ? "w-1/3" : "w-full"} overflow-auto max-h-[32rem]`}
      >
        <NoticeBoard />
      </div>
    </div>
  );
}
