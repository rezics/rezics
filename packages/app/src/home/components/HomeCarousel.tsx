import { useAlertStore } from "@app/states/windowAlertStore";
import { echoKvGetQuery } from "@rezics/contract/api/echokv/echokv.queries";
import { parseEchoKVResponse } from "@rezics/contract/api/echokv/util";
import { useTranslation } from "@rezics/i18n/react";
import { CarouselIndicator } from "@rezics/ui/primitive/carousel/CarouselIndicator.tsx";
import { useEmblaAutoplay } from "@rezics/ui/primitive/carousel/use-embla-autoplay.ts";
import { LazyLoadImage } from "@rezics/ui/primitive/image/LazyLoadImage.tsx";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { AppSafeLink as SafeLink } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";
import { useIsMobile } from "@/shared/utils/use-media-query";

type ProductType = {
  cover?: string;
  title?: string;
  lorem?: string;
  link?: string;
};

type CarouselItemLinkProps = {
  link?: string;
  children: React.ReactNode;
};

const CarouselItemLink = ({ link, children }: CarouselItemLinkProps) => {
  const href = link?.trim();
  if (!href) return <div>{children}</div>;

  return (
    <SafeLink href={href} className="block">
      {children}
    </SafeLink>
  );
};

type CarouselContentInnerProps = {
  product: ProductType;
  maxHeightClass: string;
};

const CarouselContentInner = ({
  product,
  maxHeightClass,
}: CarouselContentInnerProps) => {
  return (
    <CarouselItemLink link={product.link}>
      <div className="flex items-center gap-4 px-4">
        <div className="hidden sm:block flex-shrink-0 h-full overflow-hidden">
          <LazyLoadImage
            src={product.cover ?? ""}
            alt={product.title ?? ""}
            className={cn(
              "w-full h-full object-cover rounded-lg",
              maxHeightClass,
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h6 className="text-base font-bold mb-2">{product?.title}</h6>
          <p className="text-sm m-0">{product?.lorem}</p>
        </div>
      </div>
    </CarouselItemLink>
  );
};

type CarouselContentInnerCompactProps = {
  product: ProductType;
};

const CarouselContentInnerCompact = ({
  product,
}: CarouselContentInnerCompactProps) => {
  return (
    <CarouselItemLink link={product.link}>
      <div className="flex items-center gap-3 px-3 py-2">
        <div className="w-1/3 h-38 md:h-52 flex-shrink-0 overflow-hidden">
          <LazyLoadImage
            src={product.cover ?? ""}
            alt={product.title ?? ""}
            className={cn("h-full object-cover rounded-md")}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold whitespace-nowrap overflow-hidden text-ellipsis m-0">
            {product?.title}
          </p>
          <p className="text-xs line-clamp-4 leading-snug m-0">
            {product?.lorem}
          </p>
        </div>
      </div>
    </CarouselItemLink>
  );
};

interface BookCarouselProps {
  autoplayIntervalNum?: number;
}

/**
 * 首页轮播图组件
 *
 * 自适应图书轮播展示。在移动端展示紧凑布局（左侧封面1/3宽度+右侧信息）；在平板及以上尺寸展示宽敞布局
 * （左侧封面 max-h-[250px] + 右侧信息）。自动播放可配置，支持触摸交互停止。
 *
 * 响应式设计（sm: 640px, md: 768px, lg: 1024px, 2xl: 1536px）
 *
 * 移动端 <640px（紧凑模式 CompactCarousel）:
 * ┌─────────────────────────────┐
 * │ [img|1/3] [title/desc|2/3] │ 轮播宽度 min(600px, 100%)
 * │ w-1/3     flex-1            │ 封面高 h-38 (152px)
 * └─────────────────────────────┘ 间距 gap-3, 内边距 px-3 py-2
 *
 * 平板 640px-767px（紧凑模式 CompactCarousel）:
 * ┌──────────────────────────────────┐
 * │ [img|1/3] [title/desc|2/3]       │ 轮播宽度 min(600px, 100%)
 * │ w-1/3     flex-1                 │ 封面高 h-52 (208px)，md 尺寸生效
 * └──────────────────────────────────┘ 间距 gap-3, 内边距 px-3 py-2
 *
 * 桌面 1024px-1535px（宽敞模式 FullWidthCarousel）:
 * ┌──────────────────────────────────────────────────────────┐
 * │ [     img      ] [title]          │ 轮播宽度 min(800px, 100%)
 * │ max-h-250      │ [desc...]        │ 封面 max-h-[250px] + object-cover
 * │ flex-shrink-0  │ flex-1           │ gap-4, 内边距 px-4
 * └──────────────────────────────────────────────────────────┘
 *
 * 超宽屏 >=1536px（宽敞模式 FullWidthCarousel）:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ [       img        ] [title]                                     │
 * │ max-h-250          │ [desc..............................]         │
 * │ flex-shrink-0      │ flex-1, min-w-0 for text overflow handling │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * 窄屏处理：640px 以下隐藏左侧封面（hidden sm:block），只显示标题和描述；
 * 宽屏处理：文本采用 min-w-0 防止 flex-1 内容溢出。
 */
export const BookCarousel: React.FC<BookCarouselProps> = ({
  autoplayIntervalNum = 3000,
}) => {
  const { t } = useTranslation(["page"]);
  const maxHeightClass = "max-h-[250px]";

  const { data } = useQuery(echoKvGetQuery("home_carousel"));
  type CarouselProduct = {
    cover?: string;
    title?: string;
    lorem?: string;
    link?: string;
  };

  const [products, setProducts] = useState<CarouselProduct[]>([]);
  const { show: showAlert } = useAlertStore();
  const [carouselApi, setCarouselApi] = React.useState<CarouselApi | null>(
    null,
  );

  useEffect(() => {
    try {
      setProducts(parseEchoKVResponse<CarouselProduct[]>(data) ?? []);
    } catch (error) {
      showAlert(
        t("page:home_carousel_alert_parse_failed", { error: String(error) }),
      );
    }
  }, [data, showAlert, t]);

  useEmblaAutoplay(carouselApi, {
    interval: autoplayIntervalNum,
    enabled: true,
    stopOnInteraction: true,
  });

  const isMobile = useIsMobile();

  return (
    <Carousel
      opts={{ loop: true }}
      className={cn("min-h-0", maxHeightClass)}
      setApi={(api) => setCarouselApi(api)}
    >
      <CarouselContent>
        {products?.map((product, index) => (
          <CarouselItem
            // biome-ignore lint/suspicious/noArrayIndexKey: static list
            key={index}
            className={cn(
              isMobile ? "basis-[min(600px,100%)]" : "basis-[min(800px,100%)]",
            )}
          >
            {isMobile ? (
              <CarouselContentInnerCompact product={product} />
            ) : (
              <CarouselContentInner
                product={product}
                maxHeightClass={maxHeightClass}
              />
            )}
          </CarouselItem>
        ))}
      </CarouselContent>
      {products.length > 0 && <CarouselIndicator api={carouselApi} />}
    </Carousel>
  );
};
