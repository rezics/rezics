import {Grid, Typography, useMediaQuery} from '@mui/material';
import React, {useEffect, useRef, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {echoKvGetQuery} from '@package/api/echokv/echokv';
import {parseEchoKVResponse} from '@package/api/echokv/util';
import {useAlertStore} from '@app/state/windowAlertStore';
import {LazyLoadImage} from '@/component/Common/LazyLoadImage';
import {useTranslation} from 'react-i18next';
import {Link} from '@package/ui/Navigation/Link.tsx';
import {cn} from '@/shared/util/cssUtil';
import {CarouselIndicator} from '@/component/Carousel/CarouselIndicator';

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/component/shadcn/carousel';
interface BookCarouselProps {
  autoplayIntervalNum?: number;
}

export const BookCarousel: React.FC<BookCarouselProps> = ({
  autoplayIntervalNum = 3000,
}) => {
  const maxHeightClass = 'max-h-[250px]';

  const {data} = useQuery(echoKvGetQuery('home_carousel'));
  type CarouselProduct = {
    cover?: string;
    title?: string;
    lorem?: string;
    link?: string;
  };

  const [products, setProducts] = useState<CarouselProduct[]>([]);
  const {show: showAlert} = useAlertStore();
  const {t} = useTranslation();
  const [carouselApi, setCarouselApi] = React.useState<CarouselApi | null>(
    null,
  );
  const [current, setCurrent] = React.useState(0);
  const [count, setCount] = React.useState(0);

  useEffect(() => {
    try {
      setProducts(parseEchoKVResponse<CarouselProduct[]>(data) ?? []);
    } catch (error) {
      showAlert(
        t('page.home.noticeboard.alert.parse_failed', {
          error: String(error),
        }),
      );
    }
  }, [data, showAlert, t]);

  // autoplay using carousel api
  useEffect(() => {
    if (!autoplayIntervalNum) return;

    const id = setInterval(() => {
      try {
        carouselApi?.scrollNext();
      } catch (e) {
        // ignore if api not ready
      }
    }, autoplayIntervalNum);

    return () => clearInterval(id);
  }, [autoplayIntervalNum, carouselApi]);

  const smallThanXS = useMediaQuery('(max-width: 600px)');

  const CarouselContentInner = ({product}: {product: any}) => {
    return (
      <>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          {product.title}
        </Typography>
        <Typography variant="body2">{product.lorem}</Typography>
      </>
    );
  };

  useEffect(() => {
    if (!carouselApi) {
      return;
    }
    setCount(carouselApi.scrollSnapList().length);
    setCurrent(carouselApi.selectedScrollSnap() + 1);
    carouselApi.on('select', () => {
      setCurrent(carouselApi.selectedScrollSnap() + 1);
    });
  }, [carouselApi]);

  return (
    <Carousel
      opts={{loop: true}}
      className={cn('min-h-0', maxHeightClass)}
      setApi={api => setCarouselApi(api)}
    >
      <CarouselContent>
        {products?.map((product, index) => (
          <CarouselItem key={index} className="basis-[min(800px,100%)]">
            <Link to={product?.link ?? '#'}>
              <div className="flex items-center gap-4 px-4">
                <div className="hidden sm:block flex-shrink-0 h-full overflow-hidden rounded-lg">
                  <LazyLoadImage
                    src={product.cover ?? ''}
                    alt={product.title ?? ''}
                    className={cn('w-full h-full object-cover', maxHeightClass)}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  {smallThanXS ? (
                    <div
                      className="relative w-full h-[250px] sm:h-[280px] rounded-lg overflow-hidden flex items-end"
                      style={{
                        backgroundImage: `url(${product.cover ?? ''})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                      }}
                    >
                      {/* 暗幕遮罩，向上渐变 → 更读得清 */}

                      {/* 内容层 */}
                      <div className="relative z-10 w-full space-y-1 text-white p-3 sm:p-6 ">
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent backdrop-blur-sm mb-0" />
                        <Typography
                          variant="caption"
                          className="line-clamp-3 opacity-90"
                        >
                          <div className="font-bold">{product.title}</div>
                          {product.lorem}
                        </Typography>
                      </div>
                    </div>
                  ) : (
                    <CarouselContentInner product={product} />
                  )}
                </div>
              </div>
            </Link>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselIndicator api={carouselApi} />
    </Carousel>
  );
};
