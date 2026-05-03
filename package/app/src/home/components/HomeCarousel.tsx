import { useAlertStore } from "@app/states/windowAlertStore";
import { echoKvGetQuery } from "@rezics/api/echokv/echokv";
import { parseEchoKVResponse } from "@rezics/api/echokv/util";
import { CarouselIndicator } from "@rezics/ui/primitive/carousel/CarouselIndicator.tsx";
import { useEmblaAutoplay } from "@rezics/ui/primitive/carousel/use-embla-autoplay.ts";
import { LazyLoadImage } from "@rezics/ui/primitive/image/LazyLoadImage.tsx";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/css-util";
import { useIsMobile } from "@/shared/utils/use-media-query";

type ProductType = {
  cover?: string;
  title?: string;
  lorem?: string;
  link?: string;
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
    <Link to={product?.link ?? "#"}>
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
    </Link>
  );
};

type CarouselContentInnerCompactProps = {
  product: ProductType;
};

const CarouselContentInnerCompact = ({
  product,
}: CarouselContentInnerCompactProps) => {
  return (
    <Link to={product?.link ?? "#"}>
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
    </Link>
  );
};

interface BookCarouselProps {
  autoplayIntervalNum?: number;
}

export const BookCarousel: React.FC<BookCarouselProps> = ({
  autoplayIntervalNum = 3000,
}) => {
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
  const { t } = useTranslation();
  const [carouselApi, setCarouselApi] = React.useState<CarouselApi | null>(
    null,
  );

  useEffect(() => {
    try {
      setProducts(parseEchoKVResponse<CarouselProduct[]>(data) ?? []);
    } catch (error) {
      showAlert(
        t("page.home.carousel.alert.parse_failed", {
          error: String(error),
        }),
      );
    }
  }, [data, showAlert, t]);

  // autoplay using carousel api
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
