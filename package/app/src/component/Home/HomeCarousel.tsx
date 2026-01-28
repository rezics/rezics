import { Grid, Typography, useMediaQuery } from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { echoKvGetQuery } from '@package/api/echokv/echokv';
import { parseEchoKVResponse } from '@package/api/echokv/util';
import { useAlertStore } from '@/global/windowAlertStore';
import { LazyLoadImage } from '@/component/Common/LazyLoadImage';
import { useTranslation } from 'react-i18next';
import { Link } from '@/component/Navigation/Link';

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/component/ui/carousel';
interface BookCarouselProps {
  autoplayIntervalNum?: number;
}

export const BookCarousel: React.FC<BookCarouselProps> = ({
  autoplayIntervalNum = 3000,
}) => {
  const { data } = useQuery(echoKvGetQuery('home_carousel'));
  type CarouselProduct = {
    cover?: string;
    title?: string;
    lorem?: string;
    link?: string;
  };

  const [products, setProducts] = useState<CarouselProduct[]>([]);
  const { show: showAlert } = useAlertStore();
  const { t } = useTranslation();
  const carouselApiRef = useRef<CarouselApi | null>(null);

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
        carouselApiRef.current?.scrollNext();
      } catch (e) {
        // ignore if api not ready
      }
    }, autoplayIntervalNum);

    return () => clearInterval(id);
  }, [autoplayIntervalNum]);

  const smallThanXS = useMediaQuery('(max-width: 600px)');

  const CarouselContentInner = ({ product }: { product: any }) => {
    return (
      <>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          {product.title}
        </Typography>
        <Typography variant="body2">{product.lorem}</Typography>
      </>
    );
  };

  return (
    <Carousel
      opts={{ loop: true }}
      className="min-h-[200px]"
      setApi={api => (carouselApiRef.current = api)}
    >
      <CarouselContent>
        {products?.map((product, index) => (
          <CarouselItem key={index}>
            <Link to={product?.link ?? '#'}>
              <Grid container spacing={2} alignItems="center" sx={{ px: 2 }}>
                <Grid size={{ xs: 0, sm: 3 }}>
                  <LazyLoadImage
                    src={product.cover ?? ''}
                    alt={product.title ?? ''}
                    className="w-full h-full object-cover rounded-lg"
                  />
                </Grid>
                <Grid size={{ xs: 10, sm: 9 }}>
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
                </Grid>
              </Grid>
            </Link>
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
};
