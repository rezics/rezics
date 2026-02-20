import {Typography} from '@mui/material';
import {useIsMobile} from '@/shared/util/use-media-query';
import React, {useEffect, useMemo, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {echoKvGetQuery} from '@package/api/echokv/echokv';
import {parseEchoKVResponse} from '@package/api/echokv/util';
import {useAlertStore} from '@app/state/windowAlertStore';
import {LazyLoadImage} from '@/component/Common/LazyLoadImage';
import {useTranslation} from 'react-i18next';
import {Link} from '@package/ui/Navigation/Link.tsx';
import {cn} from '@/shared/util/css-util';
import {CarouselIndicator} from '@/component/Carousel/CarouselIndicator';

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/component/shadcn/carousel';
import {useAppStore} from '@/app/state/appStore';

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
    <Link to={product?.link ?? '#'}>
      <div className="flex items-center gap-4 px-4">
        <div className="hidden sm:block flex-shrink-0 h-full overflow-hidden">
          <LazyLoadImage
            src={product.cover ?? ''}
            alt={product.title ?? ''}
            className={cn(
              'w-full h-full object-cover rounded-lg',
              maxHeightClass,
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            {product?.title}
          </Typography>
          <Typography variant="body2">{product?.lorem}</Typography>
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
    <Link to={product?.link ?? '#'}>
      <div className="flex items-center gap-3 px-3 py-2">
        <div className="w-1/3 h-38 md:h-52 flex-shrink-0 overflow-hidden">
          <LazyLoadImage
            src={product.cover ?? ''}
            alt={product.title ?? ''}
            className={cn('h-full object-cover rounded-md')}
          />
        </div>
        <div className="flex-1 min-w-0">
          <Typography variant="subtitle2" fontWeight="600" noWrap>
            {product?.title}
          </Typography>
          <Typography variant="caption" className="line-clamp-4 leading-snug">
            {product?.lorem}
          </Typography>
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
  const [_current, setCurrent] = React.useState(0);
  const [_count, setCount] = React.useState(0);

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

  const isMobile = useIsMobile();

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
          <CarouselItem
            key={index}
            className={cn(
              isMobile ? 'basis-[min(600px,100%)]' : 'basis-[min(800px,100%)]',
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
      <CarouselIndicator api={carouselApi} />
    </Carousel>
  );
};
